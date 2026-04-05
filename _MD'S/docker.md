# **Docker**

[Docker](#docker)
[Dockerfile](#dockerfile)
[Docker Compose](#docker-compose)
[Управление контейнерами](#управление-контейнерами)
[Networking](#networking)
[Environment (окружение)](#environment-окружение)
[Database](#database)

## Docker

> Docker - платформа для запуска приложений в изолированных окружениях, называемых контейнерами. Контейнер содержит всё необходимое для работы приложения: код, зависимости, конфигурацию и системные библиотеки. 

В отличие от виртуальных машин, контейнеры используют ядро хостовой ОС и потому запускаются мгновенно и потребляют минимум ресурсов.

## Dockerfile

> Dockerfile - это текстовый документ, который содержит инструкции для создания образа, иначе говоря скрипт. Именно он позволяет автоматизировать развертывание сервисов и ПО. Роль его заключается в внесении изменений в стандартную файловую систему ОС, после чего она может запускаться с внесенными изменениями в изолированной среде.

#### Пример Dokerfile:

``` dokerfile
FROM python:3.9-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "app.py"]
```
1. Указываем базовый образ, на основе которого будет создан наш контейнер

``` dokerfile
FROM python:3.9-alpine
```

2. Устанавливаем переменные окружения

``` dokerfile
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
```

3. Создаем рабочую директорию внутри контейнера

``` dokerfile
WORKDIR /app
```

4. Копируем файл с зависимостями в контейнер

``` dokerfile
COPY requirements.txt .
```

5. Устанавливаем зависимости приложения из requirements.txt

``` dokerfile
RUN pip install --no-cache-dir -r requirements.txt
```

6. Копируем остальные файлы приложения в контейнер

``` dokerfile
COPY . .
```

7. Указываем, какой порт будет использовать приложение внутри контейнера

``` dokerfile
EXPOSE 8000
```

8. Определяем команду, которая будет выполнена при запуске контейнера

``` dokerfile
CMD ["python", "app.py"]
```

## Docker Compose

> Docker Compose - инструмент для описания и запуска многоконтейнерных приложений. Вся конфигурация хранится в docker-compose.yml: какие сервисы запускать, как они связаны, какие порты открыты, какие данные сохраняются.

#### Пример Docker Compose:

``` yml
version: '3.8'

services:
  web:
    build: .
    container_name: python_app
    ports:
      - "5000:5000"
    volumes:
      - ./app:/app
    depends_on:
      redis:
        condition: service_healthy
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379

  redis:
    image: redis:alpine
    container_name: redis_cache
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

service - отдельный контейнер в составе приложения. Каждый сервис собирается из образа или Dockerfile.

depends_on - порядок запуска. С условием service_healthy сервис дождётся, пока зависимость пройдёт healthcheck.

healthcheck - периодическая проверка работоспособности контейнера. Если проверка не проходит, контейнер помечается как unhealthy.

volumes - монтирование данных. 

``` bash
docker compose up -d               # запустить все сервисы в фоне
docker compose down                # остановить и удалить контейнеры
docker compose down -v             # удалить volumes
docker compose logs -f app         # следить за логами сервиса
docker compose exec app sh         # открыть shell внутри контейнера
docker compose build --no-cache    # пересобрать образы
```

## Управление контейнерами

#### Запуск

``` bash
docker run -d --name myapp -p 3000:3000 myapp:1.0  # Запускает контейнер myapp в фоне с пробросом порта
docker run --rm -it ubuntu:24.04 bash              # Запускает интерактивный контейнер Ubuntu с удалением после выхода
```

#### Просмотр состояния

``` bash
docker ps           # запущенные контейнеры
docker ps -a        # все контейнеры, включая остановленные
docker stats        # CPU, RAM, сеть в реальном времени
docker top myapp    # процессы внутри контейнера
```

#### Управление жизненным циклом

``` bash
docker stop myapp       # SIGTERM → ждёт graceful shutdown
docker kill myapp       # SIGKILL → мгновенное завершение
docker restart myapp    # перезапуск
docker rm myapp         # удалить остановленный контейнер
docker rm -f myapp      # остановить и удалить принудительно
```

#### Трейсинг и логи
docker logs выводит stdout/stderr контейнера. Флаг -f работает как tail -f - показывает новые строки по мере появления.

``` bash
docker logs myapp
docker logs -f myapp
docker logs --tail 100 myapp          # последние 100 строк
docker logs --since 10m myapp         # за последние 10 минут

docker inspect myapp                  # полная метаинформация в JSON
docker inspect myapp | grep -i ipadd  # найти IP контейнера
```

#### Кеш и очистка
Docker накапливает неиспользуемые образы, остановленные контейнеры и кеш сборщика. system prune очищает всё это разом.

``` bash
docker system prune       # остановленные контейнеры + dangling-образы
docker system prune -a    # все образы, не используемые запущенными контейнерами
docker volume prune       # неиспользуемые volumes
docker builder prune      # кеш сборки (build cache)
```

#### Файловая система

``` bash
docker cp file.txt myapp:/app/        # скопировать файл хост → контейнер
docker cp myapp:/app/logs ./          # скопировать файл контейнер → хост
docker diff myapp                     # показать изменения относительно исходного образа
```

## Networking

> По умолчанию контейнеры подключаются к сети bridge - изолированной виртуальной сети. Контейнеры в одной сети могут общаться между собой, снаружи они недоступны если не пробросить порты.

Пользовательская bridge-сеть отличается от дефолтной тем, что контейнеры находят друг друга по имени сервиса (встроенный DNS), а не только по IP. Именно поэтому в compose-файле можно писать http://db:5432 вместо IP-адреса.

host - контейнер использует сетевой стек хоста напрямую, без изоляции. Порты контейнера - это порты хоста.

none - контейнер полностью изолирован, без сети.

``` bash
docker network ls
docker network create mynet
docker network inspect mynet
docker network connect mynet myapp      # подключить контейнер к сети
docker network disconnect mynet myapp
```

``` yml
# Несколько изолированных сетей в compose
networks:
  frontend:   # app + nginx
  backend:    # app + db (недоступно снаружи)
```

## Environment (окружение)

> Переменные окружения - набор пар KEY=VALUE, доступных любому запущенному процессу. Позволяют передавать конфигурацию (URL базы данных, секреты, режим работы) отдельно от кода. Код читает process.env.DATABASE_URL или os.environ['DATABASE_URL'] - и не важно, где реально хранится значение.

#### Без Docker

``` bash
# Установить переменную для текущей сессии
export DATABASE_URL="postgres://user:pass@localhost:5432/db"
node app.js

# Передать только для одного запуска
DATABASE_URL="postgres://..." node app.js
```

Файл .env - удобное место для хранения переменных в разработке. Приложение читает его через библиотеку (dotenv для Node, python-dotenv для Python и т.д.).

``` bash
# .env
DATABASE_URL=postgres://user:pass@localhost:5432/db
NODE_ENV=development
SECRET_KEY=supersecret
```

#### C Docker

``` bash
# Передать переменные через флаги
docker run -e NODE_ENV=production -e PORT=3000 myapp

# Передать через файл
docker run --env-file .env myapp
```

``` yml
# В docker-compose.yml
services:
  app:
    env_file:
      - .env                  # прочитать все переменные из файла
    environment:
      - NODE_ENV=production   # переопределяет значение из .env
```

.env рядом с docker-compose.yml автоматически используется для подстановки ${VAR} внутри самого compose-файла. Чтобы передать переменные в контейнер - нужен явный env_file.

## Database

#### Adminer

> Adminer - лёгкий веб-интерфейс для управления базами данных. Поддерживает PostgreSQL, MySQL, SQLite и др. Запускается как отдельный контейнер рядом с БД.

``` yml
services:
  adminer:
    image: adminer
    ports:
      - "8080:8080"
    networks:
      - backend
```

После запуска открыть http://localhost:8080. В форме входа указать: System - PostgreSQL, Server - db (имя сервиса в compose), Username/Password/Database - из переменных окружения БД.

#### Dump & Restore

> Dump - создание резервной копии базы данных в виде SQL-файла или бинарного архива. Restore - восстановление БД из этой копии.

##### PostgreSQL

> pg_dump создаёт дамп. Флаг -Fc — кастомный бинарный формат (меньше весит, восстанавливается быстрее через pg_restore). Без флага — обычный SQL.

``` bash
# Дамп в SQL
docker exec db_container pg_dump -U user mydb > backup.sql

# Дамп в бинарный формат
docker exec db_container pg_dump -U user -Fc mydb > backup.dump

# Восстановить из SQL
docker exec -i db_container psql -U user mydb < backup.sql

# Восстановить из бинарного формата
docker exec -i db_container pg_restore -U user -d mydb < backup.dump
```

##### MySQL / MariaDB

``` bash
# Дамп
docker exec db_container mysqldump -u user -ppass mydb > backup.sql

# Восстановить
docker exec -i db_container mysql -u user -ppass mydb < backup.sql
```