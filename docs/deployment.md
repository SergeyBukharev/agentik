# Публикация Agentik на GitHub Pages

Проект локальный; публикация пока не выполнялась. Целевой репозиторий из исходного чата: `sergeybukharev/agentik`. Репозиторий портфолио не используется.

1. Создать пустой репозиторий `agentik` в нужном аккаунте.
2. Проверить `npm run check`.
3. Добавить remote только после проверки адреса:

```powershell
git remote add origin https://github.com/sergeybukharev/agentik.git
git push -u origin feat/agentik
```

4. Создать PR и объединить в `main` или запустить workflow вручную для нужной ветки.
5. В Settings → Pages выбрать Source → GitHub Actions.
6. После успешного workflow проверить `https://sergeybukharev.github.io/agentik/`.

`vite.config.ts` использует base `/agentik/`. Переходы используют `#/...`, поэтому прямые ссылки на чаты не требуют SPA rewrite на Pages. Для другого подпути изменить base и BASE в `scripts/offline-plugin.ts`, затем пересобрать.

GitHub Pages не запускает Node API. Демо работает без backend. При будущем подключении отдельного API передать публичный URL через repository variable VITE_API_URL и настроить ALLOWED_ORIGIN на сервере. Секрет AI хранить на сервере.

Service worker обновляется при следующем открытии; новая версия активируется после закрытия старых вкладок. Он не делает агрессивный skipWaiting, чтобы не смешивать версии. При диагностике старой сборки закрыть все вкладки приложения и открыть заново.
