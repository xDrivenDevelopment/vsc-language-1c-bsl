*For English please scroll down*

# Поддержка языка 1С:Предприятие 8 (BSL) в VSC

[![Join the chat at https://gitter.im/xDrivenDevelopment/1c-syntax](https://badges.gitter.im/xDrivenDevelopment/1c-syntax.svg)](https://gitter.im/xDrivenDevelopment/1c-syntax?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![GitHub release](https://img.shields.io/github/release/1c-syntax/vsc-language-1c-bsl.svg)](https://github.com/1c-syntax/vsc-language-1c-bsl/blob/master/CHANGELOG.md)
[![Build Status](https://travis-ci.org/1c-syntax/vsc-language-1c-bsl.svg?branch=develop)](https://travis-ci.org/1c-syntax/vsc-language-1c-bsl)
[![codecov](https://codecov.io/gh/1c-syntax/vsc-language-1c-bsl/branch/develop/graph/badge.svg)](https://codecov.io/gh/1c-syntax/vsc-language-1c-bsl)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=vsc-language-bsl-plugin&metric=alert_status)](https://sonarcloud.io/dashboard?id=vsc-language-bsl-plugin)
[![Greenkeeper badge](https://badges.greenkeeper.io/1c-syntax/vsc-language-1c-bsl.svg)](https://greenkeeper.io/)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2F1c-syntax%2Fvsc-language-1c-bsl.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2F1c-syntax%2Fvsc-language-1c-bsl?ref=badge_shield)

Добавляет подсветку встроенного языка 1С:Предпрятие 8 файлам \*.bsl и \*.os - синтаксис `1C (BSL)`.  
Добавляет подсветку текста запросов языка запросов 1С: внутри текста модуля или отдельно - синтаксис `1C (Query)`.

### Дополнительные возможности

* Список процедур и функций текущего файла (`Ctrl`+`Shift`+`O`)
* Переход к определению процедур и функций (`F12`)
* Автодополнение процедур и функций глобального контекста
* Сниппеты (шаблоны текста)
* Использование автоматических отступов по ключевым словам
* Автоматическое добавление символа `|` при добавлении новой строки во время редактирования строкового литерала
* Автоматическое добавление символов `//` при добавлении новой строки во время редактирования комментария по нажатию `Shift-Enter`
* Запуск скриптов `.os`/`.bsl` с помощью OneScript - [инструкция](https://github.com/1c-syntax/vsc-language-1c-bsl/wiki/%D0%97%D0%B0%D0%BF%D1%83%D1%81%D0%BA-%D1%81%D0%BA%D1%80%D0%B8%D0%BF%D1%82%D0%BE%D0%B2-.os-.bsl-%D1%81-%D0%BF%D0%BE%D0%BC%D0%BE%D1%89%D1%8C%D1%8E-OneScript)
* Проверка корректности кода в файлах `*.os` и `*.bsl` (опционально) через интерпретатор OneScript - [инструкция](https://github.com/1c-syntax/vsc-language-1c-bsl/wiki/%D0%98%D1%81%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5-%D0%BB%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D0%B0)
* Автоматическая вставка скобок
* Динамические шаблоны (`Ctrl`+`Q`) - [инструкция](https://github.com/1c-syntax/vsc-language-1c-bsl/wiki/%D0%94%D0%B8%D0%BD%D0%B0%D0%BC%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B5-%D1%88%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD%D1%8B)

Система автодополнения - [описание](https://github.com/1c-syntax/vsc-language-1c-bsl/wiki/%D0%9E%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5-%D0%B8%D0%B7%D0%BC%D0%B5%D0%BD%D0%B5%D0%BD%D0%B8%D0%B9-%D1%80%D0%B5%D0%BB%D0%B8%D0%B7%D0%B0-1.5.0)
* Переход к определению
* Поиск мест использования процедур
* Информация о процедуре
* Предварительный просмотр определения процедуры
* Автодополнение через точку
* Подсказка по параметрам процедур
* Поиск определения
* Поддержка английского языка конфигурации
* Создание описания метода
* Синтаксис-помощник по функциям глобального контекста

Система автодополнения для библиотек OneScript -  
* Переход к определению 
* Информация о процедуре 
* Предварительный просмотр определения процедуры 
* Автодополнение через точку 
* Подсказка по параметрам процедур 
* Создание описания метода 
* Синтаксис-помощник по функциям глобального контекста 
 
> **Ограничения:**   
Требуется установка пакета oscript-config из opm   
В библиотеке OneScript должен присутствовать файл lib.config   
Для работы автодополнения классов имя переменной должно совпадать с именем класса 

Сотрудничество крайне приветствуется. Разработка грамматик ведется в родительском репозитории [1c-syntax/1c-syntax](https://github.com/1c-syntax/1c-syntax).

### Установка

[Wiki](https://github.com/1c-syntax/vsc-language-1c-bsl/wiki/%D0%A3%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BA%D0%B0-%D0%BF%D0%B0%D0%BA%D0%B5%D1%82%D0%B0)

### Лицензия

[MIT](https://github.com/1c-syntax/vsc-language-1c-bsl/blob/master/LICENSE.md)

# 1С:Enterprise 8 (BSL) language support in VSC

Adds syntax highlighting to \*.bsl и \*.os files in VSC.

Contributions are greatly appreciated. Development is carried in a parent repository [1c-syntax/1c-syntax](https://github.com/1c-syntax/1c-syntax)

### Installation

[Wiki](https://github.com/1c-syntax/vsc-language-1c-bsl/wiki/Installation)

### License

[MIT](https://github.com/1c-syntax/vsc-language-1c-bsl/blob/master/LICENSE.md)

![bsl-vsc](https://cloud.githubusercontent.com/assets/1132840/13007621/9e730984-d1a2-11e5-8ff5-8f7945421184.PNG)

![query-vsc](https://cloud.githubusercontent.com/assets/1132840/13007618/9e6f578a-d1a2-11e5-9e30-7d48a269450d.PNG)



[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2F1c-syntax%2Fvsc-language-1c-bsl.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2F1c-syntax%2Fvsc-language-1c-bsl?ref=badge_large)