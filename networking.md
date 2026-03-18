# **Linux Networking**

[Firewall (UFW)](#firewall-ufw)
[iptables](#iptables)
1. [Структура (таблицы и цепочки)](#структура-таблицы-и-цепочки)
2. [Access / Deny](#access--deny)
3. [iptables + Docker Network](#iptables--docker-network)

[curl](#curl)

## Firewall (UFW)

> UFW (Uncomplicated Firewall) - упрощённый интерфейс управления файрволом, стандартный для Ubuntu/Debian. Под капотом управляет iptables, но скрывает его сложность. Правила применяются сразу после добавления.

Порядок правил имеет значение - UFW применяет первое совпавшее правило. Более специфичные правила (например, ограничение по IP) нужно добавлять раньше общих.

```bash
# Статус и просмотр текущих правил
ufw status
ufw status verbose

# Включение / отключение
ufw enable
ufw disable
ufw reset              # сбросить все правила до дефолтных
```

Разрешить входящие подключения на порт:

```bash
ufw allow 22           # SSH
ufw allow 80           # HTTP
ufw allow 443          # HTTPS
ufw allow 8080/tcp     # явно указать протокол
```

Разрешить только с конкретной подсети - например, доступ к PostgreSQL только из локальной сети:

```bash
ufw allow from 192.168.1.0/24 to any port 5432
```

Запретить подключения:

```bash
ufw deny 23
ufw deny from 1.2.3.4   # заблокировать конкретный IP
```

Удалить правило:

```bash
ufw delete allow 8080
ufw delete deny 23
```

## iptables

> iptables - низкоуровневый файрвол ядра Linux. UFW и Docker управляют им под капотом. Для понимания поведения системы важно знать структуру iptables - особенно при работе с Docker, который активно модифицирует таблицы iptables самостоятельно.

#### Структура (таблицы и цепочки)

> Таблица (table) - группа цепочек с определённым назначением. 

Основные таблицы: filter (разрешение/запрет трафика) и nat (преобразование адресов и портов).

> Цепочка (chain) - упорядоченный список правил. Пакет проходит по правилам сверху вниз и применяется первое совпавшее. 

В таблице filter три основных цепочки: INPUT (входящий трафик к хосту), OUTPUT (исходящий от хоста), FORWARD (транзитный трафик через хост - именно здесь работает Docker).

```bash
# Просмотр правил таблицы filter
iptables -L -v -n

# Просмотр таблицы nat
iptables -t nat -L -v -n

# С номерами строк (удобно для удаления по номеру)
iptables -L INPUT -v -n --line-numbers
```

#### Access / Deny

Разрешить входящий трафик - флаг -A добавляет правило в конец цепочки, -I - вставляет в начало (более высокий приоритет).

```bash
# Разрешить HTTP и HTTPS
iptables -A INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT

# Разрешить уже установленные соединения (важно - без этого ответы будут дропаться)
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Разрешить loopback (внутренняя связь процессов)
iptables -A INPUT -i lo -j ACCEPT

# Заблокировать конкретный IP
iptables -A INPUT -s 1.2.3.4 -j DROP
```

Ограничить количество новых подключений по SSH - защита от брутфорса. recent отслеживает историю подключений с каждого IP.

```bash
iptables -A INPUT -p tcp --dport 22 -m state --state NEW \
  -m recent --set --name SSH
iptables -A INPUT -p tcp --dport 22 -m state --state NEW \
  -m recent --update --seconds 60 --hitcount 4 --name SSH -j DROP
```

Удалить правило:

```bash
iptables -D INPUT -p tcp --dport 80 -j ACCEPT   # по описанию
iptables -D INPUT 3                              # по номеру строки
```

Политика по умолчанию - что делать с пакетами, которые не совпали ни с одним правилом:

```bash
iptables -P INPUT DROP      # все необработанные входящие - дропать
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT   # исходящий трафик разрешить
```

Сохранить правила (иначе сбросятся после перезагрузки):

```bash
apt install iptables-persistent
netfilter-persistent save
```

#### iptables + Docker Network

Docker добавляет собственные цепочки в iptables - DOCKER, DOCKER-USER, DOCKER-ISOLATION-STAGE-1 и др. Трафик к контейнерам проходит через цепочку FORWARD, а не INPUT, поэтому правила в INPUT на контейнеры не влияют.

Посмотреть, что добавил Docker:

```bash
iptables -L DOCKER -v -n
iptables -L DOCKER-USER -v -n
iptables -t nat -L DOCKER -v -n
```

DOCKER-USER - единственная цепочка, которую Docker не трогает при перезапуске. Именно сюда нужно добавлять свои правила для контейнеров:

```bash
# Запретить доступ к контейнерам с конкретного IP
iptables -I DOCKER-USER -s 1.2.3.4 -j DROP

# Разрешить доступ только с определённой подсети
iptables -I DOCKER-USER ! -s 192.168.1.0/24 -j DROP
```

Проброшенный порт Docker (-p 8080:8080) открывается наружу даже если UFW его закрывает - Docker добавляет правило в nat напрямую, минуя UFW. Чтобы закрыть порт от внешнего мира, есть два способа.

Через iptables:

```bash
iptables -I DOCKER-USER -p tcp --dport 8080 ! -s 127.0.0.1 -j DROP
```

Или биндить порт только на localhost прямо в compose-файле:

```yml
ports:
  - "127.0.0.1:8080:8080"   # недоступно снаружи, доступно только с хоста
```

Разрешить трафик между контейнерами (если политика FORWARD - DROP):

```bash
iptables -A FORWARD -s 172.16.0.0/12 -j ACCEPT
iptables -A FORWARD -d 172.16.0.0/12 -j ACCEPT
```

## curl

> curl - утилита командной строки для выполнения HTTP-запросов (и не только). Незаменима для тестирования API, проверки доступности сервисов и отладки сетевых проблем.

#### GET-запросы

Простейший запрос - без флагов. Флаг -s убирает прогресс-бар (удобно в скриптах), -L следует за редиректами.

```bash
curl https://example.com
curl -sL https://example.com

# Сохранить ответ в файл
curl -o index.html https://example.com
curl -O https://example.com/archive.zip   # сохранить с оригинальным именем
```

#### POST-запросы

Флаг -d передаёт тело запроса. При использовании -d метод автоматически становится POST.

```bash
# Отправить JSON
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# Отправить форму
curl -X POST https://example.com/login \
  -d "username=alice&password=secret"
```

#### Заголовки

-H добавляет произвольный заголовок к запросу. Флаг можно указывать несколько раз.

```bash
curl -H "Authorization: Bearer <token>" https://api.example.com/me
curl -H "Content-Type: application/json" -H "X-Request-ID: 123" https://api.example.com
```

#### Просмотр ответа

-I делает HEAD-запрос и выводит только заголовки. -v показывает весь диалог - запрос и ответ включая заголовки, полезно для отладки TLS и редиректов.

```bash
curl -I https://example.com           # только заголовки ответа
curl -v https://example.com           # полный verbose-лог
curl -s -o /dev/null -w "%{http_code}" https://example.com  # только HTTP-код
```

#### Аутентификация

```bash
# Basic Auth
curl -u user:pass https://example.com/api

# Сохранить cookies после логина и использовать их в следующем запросе
curl -c cookies.txt https://example.com/login -d "user=alice&pass=secret"
curl -b cookies.txt https://example.com/profile
```

#### Загрузка файлов

-F отправляет multipart/form-data - стандартный формат для загрузки файлов через HTML-форму.

```bash
curl -F "file=@photo.jpg" https://example.com/upload
curl -F "file=@data.csv" -F "description=Report" https://api.example.com/upload
```

#### Дополнительно

```bash
# Таймауты (важно в скриптах - без них curl может зависнуть навсегда)
curl --connect-timeout 5 --max-time 10 https://example.com

# Прокси
curl -x http://proxy.example.com:8080 https://target.com

# Игнорировать ошибки SSL-сертификата (только для dev/localhost)
curl -k https://localhost:8443

# Проверить доступность TCP-порта
curl -v telnet://example.com:5432
```