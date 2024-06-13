# @nence/mymig

## Feature
Migration tool for mysql that does not require up/down and is difference detection type.

## Install

```
npm install @nence/mymig
```

## .env sample for .devcontainer

```
# for mysql service
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_ROOT_USER=root
MYSQL_ROOT_PASSWORD=rootpass
MYSQL_USER=user
MYSQL_PASSWORD=userpass
MYSQL_DATABASE=user
TZ=Asia/Tokyo

# for phpmyadmin service
PMA_ARBITRARY=1
PMA_HOST=${MYSQL_HOST}
PMA_USER=${MYSQL_ROOT_USER}
PMA_PASSWORD=${MYSQL_ROOT_PASSWORD}
```

## Sample


EOF
