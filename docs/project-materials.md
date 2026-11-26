# Материалы Agentik

Лендинг, браузерные демопрофили и киты доступны на GitHub Pages. [Лендинг](https://sergeybukharev.github.io/agentik/) · [Вход в Free и PRO](https://sergeybukharev.github.io/agentik/#/login) · [Все файлы репозитория](file-list.txt)

## Экраны и сценарии

| Материал | Содержание |
| --- | --- |
| [Карта экранов и функций](experience-map.md) | Лендинг, вход, каталог, карточки помощников, личные и групповые чаты, избранное, история, бюджет, доски, профиль, PRO, договор, офлайн и ошибки |
| [UI-кит](https://sergeybukharev.github.io/agentik/#/ui-kit) | Кнопки, поля, меню, карточки, слайдер, подсказки, состояния загрузки и ошибок |
| [Бренд-кит](https://sergeybukharev.github.io/agentik/#/brand-kit) | Правила логотипа, палитра, копирование SVG и выгрузка PNG в 1× и 2× |
| [Пресс-кит](https://sergeybukharev.github.io/agentik/#/press-kit) | Описание проекта, логотипы и иллюстрации |
| [Соглашение](https://sergeybukharev.github.io/agentik/#/agreement) | Условия и локальная отметка о согласии |
| [Инструкция Telegram](telegram-mini-app.md) | Установка Mini App, экран входа, компактная копия чата и отзыв ссылки |

## Продукт и бизнес

| Файл | Содержание |
| --- | --- |
| [Требования к продукту](product-requirements.md) | Аудитория, Job Statement, функции пилота и критерии проверки |
| [Презентация требований](agentik-prd.pptx) | Сценарии, ограничения текущей версии и критерии приёмки |
| [Продуктовая презентация](agentik-product-story.pptx) | Как складывалась версия, JTBD, следующая цель и варианты изменения направления |
| [Следующие гипотезы](next-hypotheses.md) | Эксперименты, знаменатели, пороги решений и условия для pivot |
| [Юнит-экономика](unit-economics.xlsx) | Редактируемые допущения, web и Telegram Stars, AI и расходы на общие копии |
| [Стратегия](marketing-strategy.pdf) | Сегменты, каналы пилота, сценарии активации и измерение результатов |
| [Исследование](research.md) и [движение интерфейса](animation-research.md) | Референсы, ограничения доступа к источникам и решения по анимациям |

## Разработка и проверка

- [API и MCP](../backend-specs.md), [развёртывание](deployment.md), [QA](verification.md), [замеры рендера](performance-audit.md), [заметки по ревью](review.md) и [журнал разработки](ai-log.md).
- [Цветовые токены](../design-system/colors.json) и [скилл для нативных приложений](../.agents/skills/build-native-app-from-repo/SKILL.md).
- [Архив для Telegram](https://github.com/SergeyBukharev/agentik/blob/main/artifacts/Agentik-Telegram-Mini-App.zip) содержит `server.mjs`, `dist/`, `README-TELEGRAM.md` и документы. В распакованном архиве инструкция лежит рядом с сервером.

### Основные файлы исходников

| Путь в репозитории | Назначение |
| --- | --- |
| `src/App.tsx`, `src/routes.ts`, `src/catalog.ts` | Страницы, диплинки, навигация и каталог |
| `src/components/LandingHero.tsx`, `src/components/AgentikMark.tsx`, `src/persistent-brand.css` | Баннер, маскот, логотип и пропорции марки |
| `src/components/KitPages.tsx`, `src/components/BrandLogo.tsx`, `public/brand/` | Компоненты бренд-кита и исходные SVG |
| `src/components/ChatComposer.tsx`, `PrivateChat.tsx`, `Rooms.tsx` | Сообщения, вложения, микрофон и комнаты |
| `src/components/FamilyBudget.tsx`, `src/components/ChatBoard.tsx` | Бюджет и работа с файлами |
| `src/access-client.ts`, `server/access.ts`, `server/app.ts` | Проверка и хранение сессии и API моделей |
| `src/telegram-shell.ts`, `widget.html`, `src/telegram-widget.tsx` | Telegram SDK, безопасные отступы и отдельный экран виджета |
| `server/telegram-mini-app.ts`, `server/telegram-shares.ts` | Сервер сборки и ссылки на копии чатов |
| `scripts/package-telegram-mini-app.mjs`, `scripts/artifacts/` | Сборка архива и исходники бизнес-материалов |

Исходники находятся в публичном репозитории. Рабочие аккаунты настраиваются на сервере. [Agentik на GitHub](https://github.com/SergeyBukharev/agentik)
