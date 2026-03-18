# **NGINX**

[nginx](#nginx)
[Порты](#порты)
[Концепция](#концепция)
[Синтаксис](#синтаксис)
[Отладка](#отладка)
[Структура файлов](#структура-файлов)
[Статика](#статика)
[Reverse proxy](#reverse-proxy)
[Port managing](#port-managing)
[SSL](#ssl)

## Nginx

> Nginx - веб-сервер и обратный прокси. Принимает запросы снаружи и либо отдаёт статику, либо перенаправляет трафик на backend.

## Порты

> Порт - числовой идентификатор, по которому операционная система понимает, какому процессу передать входящий сетевой пакет.

``` bash
80 - HTTP, стандартный веб-трафик
443 - HTTPS, зашифрованный трафик
8080 - альтернативный HTTP (dev, proxy)
8443 - альтернативный HTTPS
```

## Концепция 

> Конфиг строится из server blocks - каждый описывает поведение для домена или порта. Внутри - блоки location, маршрутизирующие по URL. nginx выбирает server block по server_name, затем location по пути запроса.

``` bash
Client ─► nginx
           ├─► location /       ─► статика
           └─► location /api    ─► proxy_pass на backend
```

## Синтаксис

> Директивы бывают двух видов: простые заканчиваются ;, блочные содержат вложенные директивы в {}.

``` bash
worker_processes auto;   # простая директива

http {
    server {             # блочная директива
        listen 80;
        server_name example.com;

        location / {
            root /var/www/html;
        }
    }
}
```
Встроенные переменные: $host, $uri, $remote_addr, $request_method, $args.

## Отладка

``` bash
nginx -t                          # проверить конфиг на ошибки
nginx -T                          # вывести итоговый конфиг со всеми include
systemctl reload nginx            # применить изменения без перезапуска
systemctl restart nginx           # полный перезапуск
tail -f /var/log/nginx/error.log  # ошибки в реальном времени
ss -tlnp | grep :80               # кто занял порт
```

## Структура файлов

``` bash
/etc/nginx/
├── nginx.conf           # главный файл
├── sites-available/     # все конфиги хостов
└── sites-enabled/       # симлинки на активные
```

``` bash
ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/
```

## Статика

> try_files ищет файл, затем директорию, при неудаче возвращает 404.

``` bash
server {
    listen 80;
    server_name example.com;
    root /var/www/example;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

## Reverse proxy

> proxy_set_header передаёт оригинальные заголовки на backend, чтобы приложение видело реальный хост и IP клиента.

``` bash
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
    }
}
```

## Port managing

> Один server block может слушать несколько портов:

``` bash
server {
    listen 80;
    listen 8080;
    server_name example.com;
}
```

Редирект HTTP → HTTPS (301 - постоянный, браузеры кешируют):

``` bash
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

## SSL

> Автоматически через Certbot - получает сертификат, прописывает в конфиг, настраивает автообновление:

``` bash
apt install certbot python3-certbot-nginx
certbot --nginx -d example.com -d www.example.com
```

Ручная настройка:

``` bash
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}
```