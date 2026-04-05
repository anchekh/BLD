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

Разрешить только с конкретной подсети:

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
iptables -L -v -n                           # таблица filter
iptables -t nat -L -v -n                    # таблица nat
iptables -L INPUT -v -n --line-numbers      # с номерами строк
```

#### Access / Deny

Разрешить входящий трафик - флаг -A добавляет правило в конец цепочки, -I - вставляет в начало (более высокий приоритет).

```bash
# Разрешить HTTP и HTTPS
iptables -A INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT

# Разрешить уже установленные соединения (без этого ответы будут дропаться)
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Разрешить loopback
iptables -A INPUT -i lo -j ACCEPT

# Заблокировать конкретный IP
iptables -A INPUT -s 1.2.3.4 -j DROP
```

Удалить правило:

```bash
iptables -D INPUT -p tcp --dport 80 -j ACCEPT       # по описанию
iptables -D INPUT 3                                 # по номеру строки
```

#### iptables + Docker Network

Docker добавляет собственные цепочки в iptables - DOCKER, DOCKER-USER и тд. Трафик к контейнерам проходит через FORWARD, а не INPUT, поэтому правила в INPUT на контейнеры не влияют.

Посмотреть, что добавил Docker:

```bash
iptables -L DOCKER -v -n
iptables -L DOCKER-USER -v -n
iptables -t nat -L DOCKER -v -n
```

DOCKER-USER - единственная цепочка, которую Docker не трогает при перезапуске. Сюда нужно добавлять свои правила для контейнеров:

```bash
iptables -I DOCKER-USER -s 1.2.3.4 -j DROP            # запретить с IP
iptables -I DOCKER-USER ! -s 192.168.1.0/24 -j DROP   # только своя подсеть
```

Проброшенный порт Docker (-p 8080:8080) открывается наружу даже если UFW его закрывает - Docker добавляет правило в nat напрямую, минуя UFW. Закрыть можно двумя способами:

Через iptables:

```bash
iptables -I DOCKER-USER -p tcp --dport 8080 ! -s 127.0.0.1 -j DROP
```

Или биндить порт только на localhost в compose-файле:

```yml
ports:
  - "127.0.0.1:8080:8080"
```

## curl

> curl - утилита командной строки для выполнения HTTP-запросов (и не только). Незаменима для тестирования API, проверки доступности сервисов и отладки сетевых проблем.

#### GET-запросы

Простейший запрос - без флагов. Флаг -s убирает прогресс-бар, -L следует за редиректами.

```bash
curl https://example.com
curl -sL https://example.com
curl -o index.html https://example.com       # сохранить в файл
curl -O https://example.com/archive.zip      # сохранить с оригинальным именем
```

#### POST-запросы

Флаг -d передаёт тело запроса. При использовании -d метод автоматически становится POST.

```bash
# Отправить JSON
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "User", "email": "User@example.com"}'

# Отправить форму
curl -X POST https://example.com/login \
  -d "username=User&password=secret"
```

#### Заголовки

-H добавляет заголовок к запросу. Флаг можно указывать несколько раз.

```bash
curl -H "Authorization: Bearer <token>" https://api.example.com/me
curl -H "Content-Type: application/json" -H "X-Request-ID: 123" https://api.example.com
```

#### Просмотр ответа

-I делает HEAD-запрос и выводит только заголовки. -v показывает весь диалог - запрос и ответ включая заголовки, полезно для отладки TLS и редиректов.

```bash
curl -I https://example.com                                 # только заголовки ответа
curl -v https://example.com                                 # полный verbose-лог
curl -s -o /dev/null -w "%{http_code}" https://example.com  # только HTTP-код
```

#### Аутентификация

```bash
# Basic Auth
curl -u user:password https://example.com/api

# Сохранить cookies после логина и использовать их в следующем запросе
curl -c cookies.txt https://example.com/login -d "user=User&password=secret"
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