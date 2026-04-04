"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Locale = "ru" | "en";

const translations: Record<string, Record<Locale, string>> = {
  // ---- Главная ----
  "landing.heading": { ru: "Что бы вы хотели узнать?", en: "What would you like to explore?" },
  "landing.placeholder": { ru: "Чем могу помочь?", en: "How can I help you today?" },
  "landing.login": { ru: "Войти", en: "Log in" },
  "landing.getStarted": { ru: "Начать", en: "Get started" },
  "landing.disclaimer": { ru: "Мира может ошибаться. Проверяйте важную информацию.", en: "Mira can make mistakes. Verify important information." },

  // ---- Ввод сообщения ----
  "chat.placeholder": { ru: "Написать Мире", en: "Message Mira" },
  "chat.uploadImage": { ru: "Изображение", en: "Upload image" },
  "chat.uploadFile": { ru: "Файл", en: "Upload file" },

  // ---- Боковая панель ----
  "sidebar.newChat": { ru: "Новый чат", en: "New chat" },
  "sidebar.search": { ru: "Поиск", en: "Search" },
  "sidebar.starred": { ru: "Избранное", en: "Starred" },
  "sidebar.recents": { ru: "Недавние", en: "Recents" },
  "sidebar.collapse": { ru: "Свернуть", en: "Collapse" },

  // ---- Проекты ----
  "sidebar.projects": { ru: "Проекты", en: "Projects" },
  "sidebar.ungrouped": { ru: "Без проекта", en: "Ungrouped" },
  "project.new": { ru: "Новый проект", en: "New project" },
  "project.rename": { ru: "Переименовать", en: "Rename" },
  "project.delete": { ru: "Удалить проект", en: "Delete project" },
  "menu.moveToProject": { ru: "В проект", en: "Move to project" },
  "menu.removeFromProject": { ru: "Убрать из проекта", en: "Remove from project" },

  // ---- Организации ----
  "org.switchOrg": { ru: "Сменить организацию", en: "Switch organization" },
  "org.personal": { ru: "Личная", en: "Personal" },
  "org.settings": { ru: "Настройки организации", en: "Organization settings" },
  "org.members": { ru: "Участники", en: "Members" },
  "org.invite": { ru: "Пригласить", en: "Invite" },
  "org.remove": { ru: "Удалить", en: "Remove" },
  "org.role.owner": { ru: "Владелец", en: "Owner" },
  "org.role.admin": { ru: "Администратор", en: "Admin" },
  "org.role.member": { ru: "Участник", en: "Member" },
  "org.createNew": { ru: "Создать организацию", en: "Create organization" },
  "org.name": { ru: "Название", en: "Name" },
  "org.slug": { ru: "URL-идентификатор", en: "URL identifier" },
  "org.noMembers": { ru: "Нет участников", en: "No members" },

  // ---- Код (Remote Control) ----
  "sidebar.code": { ru: "Код", en: "Code" },
  "code.title": { ru: "Код", en: "Code" },
  "code.noSessions": { ru: "Нет подключённых сессий", en: "No connected sessions" },
  "code.noSessionsDesc": { ru: "Запустите /remote в терминале Mira CLI, чтобы подключить проект", en: "Run /remote in Mira CLI terminal to connect a project" },
  "code.connected": { ru: "Подключено", en: "Connected" },
  "code.reconnecting": { ru: "Переподключение", en: "Reconnecting" },
  "code.offline": { ru: "Не в сети", en: "Offline" },
  "code.sendPlaceholder": { ru: "Отправить команду...", en: "Send a command..." },
  "code.sessions": { ru: "Сессии", en: "Sessions" },
  "code.disconnect": { ru: "Отключить", en: "Disconnect" },
  "code.back": { ru: "Назад", en: "Back" },

  // ---- Контекстное меню чата ----
  "menu.star": { ru: "В избранное", en: "Star" },
  "menu.unstar": { ru: "Убрать", en: "Unstar" },
  "menu.rename": { ru: "Переименовать", en: "Rename" },
  "menu.delete": { ru: "Удалить", en: "Delete" },

  // ---- Меню пользователя ----
  "user.settings": { ru: "Настройки", en: "Settings" },
  "user.help": { ru: "Помощь", en: "Get help" },
  "user.plans": { ru: "Тарифы", en: "View all plans" },
  "user.learnMore": { ru: "Подробнее", en: "Learn more" },
  "user.logout": { ru: "Выйти", en: "Log out" },
  "user.helpCenter": { ru: "Центр помощи", en: "Help center" },
  "user.reportBug": { ru: "Сообщить об ошибке", en: "Report a bug" },
  "user.shortcuts": { ru: "Горячие клавиши", en: "Keyboard shortcuts" },
  "user.about": { ru: "О Мире", en: "About Mira" },
  "user.terms": { ru: "Условия", en: "Terms of Service" },
  "user.usagePolicy": { ru: "Правила", en: "Usage policy" },
  "user.privacyPolicy": { ru: "Конфиденциальность", en: "Privacy policy" },

  // ---- Тарифы ----
  "plan.free": { ru: "Бесплатный", en: "Free plan" },
  "plan.pro": { ru: "Pro", en: "Pro" },
  "plan.max": { ru: "Max", en: "Max" },
  "plan.enterprise": { ru: "Enterprise", en: "Enterprise" },

  // ---- Авторизация ----
  "auth.signInOrCreate": { ru: "Войти или создать аккаунт", en: "Sign in or create account" },
  "auth.signInBenefits": { ru: "Получите доступ к умным ответам, загрузке файлов, изображений и многому другому.", en: "Get smarter responses, upload files, images, and much more." },
  "auth.continue": { ru: "Продолжить", en: "Continue" },
  "auth.enterPassword": { ru: "Введите пароль", en: "Enter your password" },
  "auth.invalidCredentials": { ru: "Неверный пароль", en: "Invalid password" },
  "auth.passwordTooShort": { ru: "Минимум 8 символов", en: "Password must be at least 8 characters" },
  "auth.registrationFailed": { ru: "Ошибка регистрации", en: "Registration failed" },
  "auth.popupBlocked": { ru: "Попап заблокирован — разрешите попапы", en: "Popup blocked — please allow popups" },
  "auth.termsNotice": { ru: "Продолжая, вы соглашаетесь с", en: "By continuing, you agree to our" },
  "auth.terms": { ru: "Условиями", en: "Terms" },
  "auth.privacy": { ru: "Политикой конфиденциальности", en: "Privacy Policy" },
  "auth.welcomeBack": { ru: "С возвращением", en: "Welcome back" },
  "auth.createAccount": { ru: "Создать аккаунт", en: "Create account" },
  "auth.loginSubtitle": { ru: "Войдите, чтобы продолжить", en: "Log in to continue to Mira" },
  "auth.registerSubtitle": { ru: "Зарегистрируйтесь", en: "Sign up to get started with Mira" },
  "auth.continueVk": { ru: "Продолжить через VK", en: "Continue with VK" },
  "auth.continueYandex": { ru: "Продолжить через Яндекс", en: "Continue with Yandex" },
  "auth.google": { ru: "Google", en: "Google" },
  "auth.phone": { ru: "Телефон", en: "Phone" },
  "auth.or": { ru: "или", en: "or" },
  "auth.continueWithTelegram": { ru: "Войти через Telegram", en: "Continue with Telegram" },
  "auth.continueWithYandex": { ru: "Войти через Яндекс", en: "Continue with Yandex" },
  "auth.name": { ru: "Имя", en: "Name" },
  "auth.namePlaceholder": { ru: "Ваше имя", en: "Your name" },
  "auth.email": { ru: "Почта", en: "Email" },
  "auth.emailPlaceholder": { ru: "name@example.com", en: "name@example.com" },
  "auth.password": { ru: "Пароль", en: "Password" },
  "auth.passwordPlaceholderLogin": { ru: "Введите пароль", en: "Enter your password" },
  "auth.passwordPlaceholderRegister": { ru: "Придумайте пароль", en: "Create a password" },
  "auth.forgotPassword": { ru: "Забыли пароль?", en: "Forgot password?" },
  "auth.login": { ru: "Войти", en: "Log in" },
  "auth.register": { ru: "Создать аккаунт", en: "Create account" },
  "auth.noAccount": { ru: "Нет аккаунта?", en: "Don't have an account?" },
  "auth.hasAccount": { ru: "Уже есть аккаунт?", en: "Already have an account?" },
  "auth.signUp": { ru: "Регистрация", en: "Sign up" },
  "auth.loggingIn": { ru: "Вход...", en: "Logging in..." },
  "auth.creatingAccount": { ru: "Создание...", en: "Creating account..." },
  "auth.consent": { ru: "Я даю согласие на обработку персональных данных в соответствии с", en: "I consent to the processing of my personal data per the" },
  "auth.privacyPolicy": { ru: "Политикой конфиденциальности", en: "Privacy Policy" },
  "auth.resetPassword": { ru: "Сбросить пароль", en: "Reset your password" },
  "auth.resetSubtitle": { ru: "Введите email для сброса пароля.", en: "Enter your email and we'll send a reset link." },
  "auth.sendResetLink": { ru: "Отправить ссылку", en: "Send reset link" },
  "auth.checkEmail": { ru: "Проверьте почту", en: "Check your email" },
  "auth.resetSent": { ru: "Ссылка отправлена на", en: "We sent a reset link to" },
  "auth.back": { ru: "Назад", en: "Back" },
  "auth.backToLogin": { ru: "Назад", en: "Back to log in" },
  "auth.phoneLogin": { ru: "Вход по телефону", en: "Log in with phone" },
  "auth.phoneSubtitle": { ru: "Отправим код по SMS.", en: "We'll send a verification code via SMS." },
  "auth.phoneNumber": { ru: "Телефон", en: "Phone number" },
  "auth.sendCode": { ru: "Отправить код", en: "Send code" },
  "auth.verificationCode": { ru: "Код из SMS", en: "Verification code" },
  "auth.verifyAndLogin": { ru: "Подтвердить", en: "Verify & log in" },
  "auth.verifying": { ru: "Проверка...", en: "Verifying..." },

  // ---- Поиск ----
  "search.placeholder": { ru: "Поиск чатов...", en: "Search chats..." },
  "search.noResults": { ru: "Ничего не найдено", en: "No chats found" },
  "search.yourChats": { ru: "Ваши чаты", en: "Your chats" },

  // ---- Размышление ----
  "thinking.label": { ru: "Думаю", en: "Thinking" },

  // ---- Сообщения ----
  "message.cancel": { ru: "Отмена", en: "Cancel" },
  "message.send": { ru: "Отправить", en: "Send" },

  // ---- Выбор модели ----
  "model.mira": { ru: "Мира", en: "Mira" },
  "model.miraDesc": { ru: "Для большинства задач", en: "Great for most tasks" },
  "model.miraLite": { ru: "Мира Lite", en: "Mira Lite" },
  "model.miraLiteDesc": { ru: "Быстрые ответы", en: "Fastest responses" },

  // ---- Заголовок чата ----
  "topbar.star": { ru: "В избранное", en: "Star" },
  "topbar.unstar": { ru: "Убрать", en: "Unstar" },
  "topbar.rename": { ru: "Переименовать", en: "Rename" },
  "topbar.delete": { ru: "Удалить", en: "Delete" },

  // ---- Код ----
  "code.run": { ru: "Запуск", en: "Run" },
  "code.stop": { ru: "Стоп", en: "Stop" },
  "code.hideCode": { ru: "← Скрыть", en: "← Hide code" },
  "code.console": { ru: "Консоль", en: "Console" },
  "code.clickRun": { ru: "Нажмите Запуск", en: "Click Run to execute code" },

  // ---- Настройки ----
  "settings.title": { ru: "Настройки", en: "Settings" },
  "settings.general": { ru: "Общее", en: "General" },
  "settings.appearance": { ru: "Вид", en: "Appearance" },
  "settings.notifications": { ru: "Уведомления", en: "Notifications" },
  "settings.privacy": { ru: "Приватность", en: "Privacy" },
  "settings.shortcuts": { ru: "Клавиши", en: "Shortcuts" },
  "settings.calendar": { ru: "Календарь", en: "Calendar" },
  "settings.calendarFeed": { ru: "Напоминания в календаре", en: "Reminders in Calendar" },
  "settings.calendarFeedDesc": { ru: "Все напоминания Mira появятся в выбранном календаре", en: "All your Mira reminders will appear in your chosen calendar" },
  "settings.calendarAdd": { ru: "Добавить", en: "Add" },
  "settings.calendarAdded": { ru: "Добавлено", en: "Added" },
  "settings.revokeFeedUrl": { ru: "Отключить синхронизацию", en: "Disable sync" },
  "settings.feedUrlCopied": { ru: "Скопировано", en: "Copied" },
  "settings.googleCalendar": { ru: "Google Календарь", en: "Google Calendar" },
  "settings.googleSyncDesc": { ru: "Двусторонняя синхронизация — Mira видит ваш календарь", en: "Two-way sync — Mira can see your schedule" },
  "settings.googleConnect": { ru: "Подключить", en: "Connect" },
  "settings.googleDisconnect": { ru: "Отключить", en: "Disconnect" },
  "settings.googleConnected": { ru: "Подключён", en: "Connected" },
  "settings.yandexCalendar": { ru: "Яндекс Календарь", en: "Yandex Calendar" },

  "settings.language": { ru: "Язык", en: "Language" },
  "settings.theme": { ru: "Тема", en: "Theme" },
  "settings.themeDark": { ru: "Тёмная", en: "Dark" },
  "settings.themeLight": { ru: "Светлая", en: "Light" },
  "settings.themeSystem": { ru: "Системная", en: "System" },
  "settings.fontSize": { ru: "Размер шрифта", en: "Font size" },
  "settings.fontSmall": { ru: "Маленький", en: "Small" },
  "settings.fontDefault": { ru: "Обычный", en: "Default" },
  "settings.fontLarge": { ru: "Большой", en: "Large" },
  "settings.archiveChats": { ru: "Архивация чатов", en: "Archive chats" },
  "settings.archiveDesc": { ru: "Автоархивация через 30 дней", en: "Auto-archive after 30 days of inactivity" },
  "settings.deleteAll": { ru: "Удалить все чаты", en: "Delete all chats" },
  "settings.deleteAllDesc": { ru: "Это необратимо", en: "This action cannot be undone" },
  "settings.deleteAllBtn": { ru: "Удалить", en: "Delete all" },
  "settings.emailNotifs": { ru: "Email-уведомления", en: "Email notifications" },
  "settings.emailNotifsDesc": { ru: "Новости и обновления", en: "Receive updates about new features" },
  "settings.sound": { ru: "Звук", en: "Sound" },
  "settings.soundDesc": { ru: "Звук при готовности ответа", en: "Play a sound when ready" },
  "settings.chatHistory": { ru: "История чатов", en: "Chat history" },
  "settings.chatHistoryDesc": { ru: "Сохранять историю", en: "Save chat history" },
  "settings.improveMira": { ru: "Улучшение Миры", en: "Improve Mira" },
  "settings.improveMiraDesc": { ru: "Анонимные данные для обучения", en: "Anonymized data for training" },
  "settings.newChat": { ru: "Новый чат", en: "New chat" },
  "settings.searchChats": { ru: "Поиск", en: "Search chats" },
  "settings.toggleSidebar": { ru: "Панель", en: "Toggle sidebar" },
  "settings.showShortcuts": { ru: "Клавиши", en: "Show shortcuts" },
  "settings.closeModal": { ru: "Закрыть", en: "Close modal" },
  "settings.sendMessage": { ru: "Отправить", en: "Send message" },
  "settings.newLine": { ru: "Новая строка", en: "New line" },
  "settings.timezone": { ru: "Часовой пояс", en: "Timezone" },
  "settings.timezoneDesc": { ru: "Для корректного времени напоминаний", en: "For correct reminder times" },
  "settings.quietHours": { ru: "Тихие часы", en: "Quiet hours" },
  "settings.quietHoursDesc": { ru: "Не отправлять уведомления в это время", en: "Don't send notifications during this time" },
  "settings.telegramConnect": { ru: "Telegram", en: "Telegram" },
  "settings.telegramDesc": { ru: "Напоминания и чат с Мирой", en: "Reminders and chat with Mira" },
  "settings.telegramConnected": { ru: "Подключен", en: "Connected" },
  "settings.telegramConnect.btn": { ru: "Подключить", en: "Connect" },
  "settings.telegramSettings.btn": { ru: "Настроить", en: "Configure" },
  "settings.telegramNotifs": { ru: "Уведомления в Telegram", en: "Telegram notifications" },
  "settings.telegramNotifsDesc": { ru: "Напоминания приходят в Telegram", en: "Reminders sent to Telegram" },

  // ---- Профиль ----
  "settings.profile": { ru: "Профиль", en: "Profile" },
  "settings.profilePhoto": { ru: "Фото", en: "Photo" },
  "settings.profilePhotoChange": { ru: "Изменить", en: "Change" },
  "settings.profilePhotoRemove": { ru: "Удалить", en: "Remove" },
  "settings.displayName": { ru: "Как вас называть?", en: "What should Mira call you?" },
  "settings.displayNameDesc": { ru: "Короткое имя для приветствий", en: "Short name for greetings" },
  "settings.fullName": { ru: "Полное имя", en: "Full name" },
  "settings.email": { ru: "Email", en: "Email" },
  "settings.phone": { ru: "Телефон", en: "Phone" },
  "settings.profileSaved": { ru: "Сохранено", en: "Saved" },

  // ---- Напоминания и уведомления ----
  "reminders.title": { ru: "Напоминания", en: "Reminders" },
  "reminders.empty": { ru: "Нет напоминаний", en: "No reminders" },
  "reminders.emptyHint": { ru: "Попросите Миру создать одно!", en: "Ask Mira to set one!" },
  "reminders.active": { ru: "Активные", en: "Active" },
  "reminders.completed": { ru: "Выполненные", en: "Completed" },
  "reminders.all": { ru: "Все", en: "All" },
  "reminders.new": { ru: "Новое напоминание", en: "New reminder" },
  "reminders.edit": { ru: "Изменить", en: "Edit" },
  "reminders.delete": { ru: "Удалить", en: "Delete" },
  "reminders.snooze": { ru: "Отложить", en: "Snooze" },
  "reminders.created": { ru: "Сохранено", en: "Saved" },
  "reminders.cancelled": { ru: "Отменено", en: "Cancelled" },
  "reminders.fired": { ru: "Выполнено", en: "Done" },
  "notifications.title": { ru: "Уведомления", en: "Notifications" },
  "notifications.empty": { ru: "Нет уведомлений", en: "No notifications" },
  "notifications.markAllRead": { ru: "Прочитать все", en: "Mark all read" },
  "notifications.unread": { ru: "Непрочитанные", en: "Unread" },

  // ---- Reminder card / delivery ----
  "delivery.label": { ru: "Доставка", en: "Delivery" },
  "delivery.inApp": { ru: "В приложении", en: "In app" },
  "delivery.telegram": { ru: "Telegram", en: "Telegram" },
  "delivery.email": { ru: "Email", en: "Email" },
  "reminders.pause": { ru: "Пауза", en: "Pause" },
  "reminders.scheduled": { ru: "Запланировано", en: "Scheduled" },
  "reminders.recent": { ru: "Недавние", en: "Recent" },
  "reminders.subscriptions": { ru: "Рассылки", en: "Subscriptions" },
  "reminders.noReminders": { ru: "Нет напоминаний", en: "No reminders" },
  "reminders.noRemindersHint": { ru: "Попросите Миру создать одно в чате", en: "Ask Mira to create one in chat" },
  "reminders.allReminders": { ru: "Напоминания", en: "Reminders" },
  "reminders.cancel": { ru: "Отменить", en: "Cancel" },
  "reminders.today": { ru: "Сегодня", en: "Today" },
  "reminders.tomorrow": { ru: "Завтра", en: "Tomorrow" },
  "reminders.yesterday": { ru: "Вчера", en: "Yesterday" },
  "delivery.alwaysOn": { ru: "Всегда", en: "Always on" },
  "delivery.notConnected": { ru: "Не подключен", en: "Not connected" },
  "delivery.emailDesc": { ru: "Уведомления на почту", en: "Notifications to email" },

  // ---- Telegram link modal ----
  "telegram.title": { ru: "Telegram", en: "Telegram" },
  "telegram.linkDesc": { ru: "Откройте ссылку, чтобы привязать Telegram. После привязки вы сможете получать напоминания и общаться с Мирой.", en: "Open the link to connect Telegram. After connecting, you'll receive reminders and can chat with Mira." },
  "telegram.openInTelegram": { ru: "Открыть в Telegram", en: "Open in Telegram" },
  "telegram.linkExpiry": { ru: "Ссылка действует 10 минут. Страница обновится автоматически.", en: "Link valid for 10 minutes. Page updates automatically." },
  "telegram.connected": { ru: "Подключен", en: "Connected" },
  "telegram.connectedDesc": { ru: "Напоминания будут приходить в Telegram. Также можно писать Мире прямо в чат бота.", en: "Reminders will be sent to Telegram. You can also message Mira directly in the bot chat." },
  "telegram.done": { ru: "Готово", en: "Done" },
  "telegram.unlink": { ru: "Отвязать", en: "Unlink" },
  "telegram.error": { ru: "Не удалось создать ссылку. Попробуйте позже.", en: "Failed to create link. Try later." },
  "telegram.close": { ru: "Закрыть", en: "Close" },

  // ---- Scheduled content ----
  // ---- Actions ----
  "action.confirm": { ru: "Подтвердить", en: "Confirm" },
  "action.executing": { ru: "Выполняю...", en: "Executing..." },
  "action.done": { ru: "Выполнено", en: "Done" },
  "action.cancelled": { ru: "Отменено", en: "Cancelled" },
  "action.failed": { ru: "Ошибка", en: "Failed" },
  "action.draft": { ru: "Черновик", en: "Draft" },
  "action.translate": { ru: "Перевод", en: "Translation" },
  "action.timer": { ru: "Таймер", en: "Timer" },
  "action.copy": { ru: "Копировать", en: "Copy" },
  "action.copied": { ru: "Скопировано", en: "Copied" },
  "action.timerDone": { ru: "Время вышло", en: "Time's up" },
  "action.emailTo": { ru: "Кому:", en: "To:" },
  "action.emailSubject": { ru: "Тема:", en: "Subject:" },
  "action.openInEmail": { ru: "Открыть в почте", en: "Open in email" },
  "action.openWith": { ru: "Открыть в:", en: "Open with:" },
  "action.code": { ru: "Код", en: "Code" },
  "action.showMore": { ru: "Показать полностью", en: "Show more" },
  "action.weather": { ru: "Погода", en: "Weather" },
  "action.stock": { ru: "Котировка", en: "Quote" },
  "stock.live": { ru: "В реальном времени", en: "Live" },
  "stock.open": { ru: "Откр.", en: "Open" },
  "stock.prevClose": { ru: "Пред. закр.", en: "Prev Close" },
  "stock.high": { ru: "Макс.", en: "High" },
  "stock.low": { ru: "Мин.", en: "Low" },
  "stock.1d": { ru: "1Д", en: "1D" },
  "stock.1w": { ru: "1Н", en: "1W" },
  "stock.1m": { ru: "1М", en: "1M" },
  "stock.1y": { ru: "1Г", en: "1Y" },
  "stock.chartRetry": { ru: "Нажмите для повторной загрузки", en: "Tap to reload chart" },
  "stock.marketClosed": { ru: "Рынок закрыт", en: "Market closed" },
  "stock.preMarket": { ru: "Пре-маркет", en: "Pre-market" },
  "stock.afterHours": { ru: "Пост-маркет", en: "After hours" },
  "action.calc": { ru: "Расчёт", en: "Calculation" },
  "action.event": { ru: "Событие", en: "Event" },
  "action.download": { ru: "Скачать", en: "Download" },

  "scheduled.everyDay": { ru: "Каждый день", en: "Every day" },
  "scheduled.everyWeek": { ru: "Каждую неделю", en: "Every week" },
  "scheduled.everyMonth": { ru: "Каждый месяц", en: "Every month" },

  // ---- Weather ----
  "weather.feelsLike": { ru: "Ощущается", en: "Feels like" },
  "weather.wind": { ru: "Ветер", en: "Wind" },
  "weather.humidity": { ru: "Влажность", en: "Humidity" },
  "weather.precip": { ru: "Осадки", en: "Precipitation" },
  "weather.uv": { ru: "УФ", en: "UV" },
  "weather.uvLow": { ru: "Низкий", en: "Low" },
  "weather.uvModerate": { ru: "Умеренный", en: "Moderate" },
  "weather.uvHigh": { ru: "Высокий", en: "High" },
  "weather.uvVeryHigh": { ru: "Очень высокий", en: "Very high" },
  "weather.today": { ru: "Сегодня", en: "Today" },
  "weather.tomorrow": { ru: "Завтра", en: "Tomorrow" },
  "weather.Mon": { ru: "Пн", en: "Mon" },
  "weather.Tue": { ru: "Вт", en: "Tue" },
  "weather.Wed": { ru: "Ср", en: "Wed" },
  "weather.Thu": { ru: "Чт", en: "Thu" },
  "weather.Fri": { ru: "Пт", en: "Fri" },
  "weather.Sat": { ru: "Сб", en: "Sat" },
  "weather.Sun": { ru: "Вс", en: "Sun" },
  "weather.clear": { ru: "Ясно", en: "Clear" },
  "weather.mostly_clear": { ru: "Преимущественно ясно", en: "Mostly clear" },
  "weather.partly_cloudy": { ru: "Переменная облачность", en: "Partly cloudy" },
  "weather.overcast": { ru: "Пасмурно", en: "Overcast" },
  "weather.fog": { ru: "Туман", en: "Fog" },
  "weather.light_drizzle": { ru: "Лёгкая морось", en: "Light drizzle" },
  "weather.drizzle": { ru: "Морось", en: "Drizzle" },
  "weather.heavy_drizzle": { ru: "Сильная морось", en: "Heavy drizzle" },
  "weather.light_rain": { ru: "Небольшой дождь", en: "Light rain" },
  "weather.rain": { ru: "Дождь", en: "Rain" },
  "weather.heavy_rain": { ru: "Сильный дождь", en: "Heavy rain" },
  "weather.freezing_rain": { ru: "Ледяной дождь", en: "Freezing rain" },
  "weather.light_snow": { ru: "Небольшой снег", en: "Light snow" },
  "weather.snow": { ru: "Снег", en: "Snow" },
  "weather.heavy_snow": { ru: "Сильный снег", en: "Heavy snow" },
  "weather.snow_grains": { ru: "Снежная крупа", en: "Snow grains" },
  "weather.light_showers": { ru: "Небольшой ливень", en: "Light showers" },
  "weather.showers": { ru: "Ливень", en: "Showers" },
  "weather.heavy_showers": { ru: "Сильный ливень", en: "Heavy showers" },
  "weather.light_snow_showers": { ru: "Небольшой снегопад", en: "Light snow showers" },
  "weather.heavy_snow_showers": { ru: "Сильный снегопад", en: "Heavy snow showers" },
  "weather.thunderstorm": { ru: "Гроза", en: "Thunderstorm" },
  "weather.thunderstorm_hail": { ru: "Гроза с градом", en: "Thunderstorm with hail" },

  // ---- Edit reminder modal ----
  "edit.noRepeat": { ru: "Не повторять", en: "Don't repeat" },
  "edit.daily": { ru: "Каждый день", en: "Every day" },
  "edit.weekly": { ru: "Каждую неделю", en: "Every week" },
  "edit.weekdays": { ru: "По будням", en: "Weekdays" },
  "edit.monthly": { ru: "Каждый месяц", en: "Every month" },
  "edit.save": { ru: "Сохранить", en: "Save" },
  "edit.networkError": { ru: "Ошибка сети", en: "Network error" },

  // ---- Тарифы (модальное окно) ----
  "pricing.title": { ru: "Выберите тариф", en: "Choose your plan" },
  "pricing.subtitle": { ru: "Обновите или отмените в любое время.", en: "Upgrade anytime. Cancel anytime." },
  "pricing.popular": { ru: "Популярный", en: "Most popular" },
  "pricing.currentPlan": { ru: "Текущий", en: "Current plan" },
  "pricing.selected": { ru: "Выбрано", en: "Selected" },
  "pricing.footer": { ru: "Цены в ₽. Ежемесячная оплата. API — отдельно.", en: "Prices in RUB. Billed monthly. API billed separately." },
  "pricing.mo": { ru: "/мес", en: "/mo" },
  "pricing.custom": { ru: "Индивидуально", en: "Custom" },
  "pricing.upgrade": { ru: "Перейти на", en: "Upgrade to" },
  "pricing.contactSales": { ru: "Связаться", en: "Contact sales" },
  "pricing.freeDesc": { ru: "Начните с Мирой", en: "Get started with Mira" },
  "pricing.proDesc": { ru: "Для продвинутых", en: "For power users" },
  "pricing.maxDesc": { ru: "Без ограничений", en: "Unlimited" },
  "pricing.enterpriseDesc": { ru: "Для команд", en: "For teams" },

  // Функции тарифов
  "pricing.f.free.1": { ru: "1 000 сообщений в день", en: "1,000 messages per day" },
  "pricing.f.free.2": { ru: "Модель Mira Fast", en: "Mira Fast model" },
  "pricing.f.free.3": { ru: "Текстовый чат и поиск", en: "Text chat and web search" },
  "pricing.f.free.4": { ru: "Загрузка файлов", en: "File uploads" },
  "pricing.f.pro.1": { ru: "5 000 сообщений в день", en: "5,000 messages per day" },
  "pricing.f.pro.2": { ru: "Mira Pro + режим размышлений", en: "Mira Pro + thinking mode" },
  "pricing.f.pro.3": { ru: "Расширенный контекст", en: "Extended context" },
  "pricing.f.pro.4": { ru: "Голосовой ввод и вывод", en: "Voice input and output" },
  "pricing.f.pro.5": { ru: "Приоритетная скорость", en: "Priority speed" },
  "pricing.f.pro.6": { ru: "История чатов", en: "Chat history" },
  "pricing.f.pro.7": { ru: "Сверх лимита — из баланса", en: "Over limit — from balance" },
  "pricing.f.max.1": { ru: "Всё из Pro", en: "Everything in Pro" },
  "pricing.f.max.2": { ru: "Безлимит сообщений", en: "Unlimited messages" },
  "pricing.f.max.3": { ru: "Модель Mira Max", en: "Mira Max model" },
  "pricing.f.max.4": { ru: "Максимальная скорость", en: "Fastest responses" },
  "pricing.f.max.5": { ru: "Максимальный контекст", en: "Longest context" },
  "pricing.f.max.6": { ru: "Приоритетная очередь", en: "Priority queue" },
  "pricing.f.max.7": { ru: "Ранний доступ", en: "Early access to features" },
  "pricing.f.ent.1": { ru: "Своё развёртывание", en: "Custom deployment" },
  "pricing.f.ent.2": { ru: "Частное облако", en: "On-premise or private cloud" },
  "pricing.f.ent.3": { ru: "Полное соответствие", en: "Full regulatory compliance" },
  "pricing.f.ent.4": { ru: "Гарантии SLA", en: "SLA guarantees" },
  "pricing.f.ent.5": { ru: "Дообучение модели", en: "Custom model fine-tuning" },
  "pricing.f.ent.6": { ru: "Выделенная поддержка", en: "Dedicated support" },
  "pricing.f.ent.7": { ru: "SSO и аудит", en: "SSO and audit logging" },

  // ---- Платформа ----
  "platform.console": { ru: "Консоль", en: "Console" },
  "platform.analytics": { ru: "АНАЛИТИКА", en: "ANALYTICS" },
  "platform.manage": { ru: "УПРАВЛЕНИЕ", en: "MANAGE" },
  "platform.dashboard": { ru: "Дашборд", en: "Dashboard" },
  "platform.usage": { ru: "Использование", en: "Usage" },
  "platform.apiKeys": { ru: "API ключи", en: "API keys" },
  "platform.docs": { ru: "Документация", en: "Documentation" },
  "platform.apiStatus": { ru: "Статус API", en: "API status" },
  "platform.helpSupport": { ru: "Помощь", en: "Help & support" },
  "platform.feedback": { ru: "Обратная связь", en: "Feedback" },

  // ---- Feedback modal ----
  "feedback.goodTitle": { ru: "Что понравилось?", en: "What did you like?" },
  "feedback.badTitle": { ru: "Что пошло не так?", en: "What went wrong?" },
  "feedback.goodSection": { ru: "Что было хорошо", en: "What was good" },
  "feedback.badSection": { ru: "Тип проблемы", en: "Issue type" },
  "feedback.severityLabel": { ru: "Насколько серьёзно", en: "How serious" },
  "feedback.correctionLabel": { ru: "Как правильно?", en: "What's the correct answer?" },
  "feedback.correctionPlaceholder": { ru: "Напишите правильный ответ или укажите что должно было быть...", en: "Write the correct answer or describe what it should have been..." },
  "feedback.commentLabel.good": { ru: "Комментарий", en: "Comment" },
  "feedback.commentLabel.bad": { ru: "Дополнительно", en: "Additional details" },
  "feedback.commentPlaceholder.good": { ru: "Что именно понравилось...", en: "What exactly did you like..." },
  "feedback.commentPlaceholder.bad": { ru: "Подробности проблемы...", en: "Details about the issue..." },
  "feedback.anonymous": { ru: "Анонимно", en: "Anonymous" },
  "feedback.cancel": { ru: "Отмена", en: "Cancel" },
  "feedback.submit": { ru: "Отправить", en: "Submit" },
  "feedback.thanks": { ru: "Спасибо за отзыв", en: "Thanks for your feedback" },
  "feedback.thanksDetail": { ru: "Это помогает улучшить Миру", en: "This helps improve Mira" },
  // Severity
  "feedback.severity.minor": { ru: "Мелочь", en: "Minor" },
  "feedback.severity.major": { ru: "Серьёзно", en: "Major" },
  "feedback.severity.critical": { ru: "Критично", en: "Critical" },
  // Bad categories
  "feedback.cat.hallucination": { ru: "Выдумал факты", en: "Hallucinated facts" },
  "feedback.cat.factual_error": { ru: "Фактическая ошибка", en: "Factual error" },
  "feedback.cat.ignored_instructions": { ru: "Проигнорировал запрос", en: "Ignored instructions" },
  "feedback.cat.outdated": { ru: "Устаревшая информация", en: "Outdated info" },
  "feedback.cat.harmful": { ru: "Вредный контент", en: "Harmful content" },
  "feedback.cat.repetitive": { ru: "Повторяется", en: "Repetitive" },
  "feedback.cat.too_long": { ru: "Слишком длинный", en: "Too long" },
  "feedback.cat.wrong_language": { ru: "Не тот язык", en: "Wrong language" },
  // Good categories
  "feedback.cat.accurate": { ru: "Точный и верный", en: "Accurate" },
  "feedback.cat.helpful": { ru: "Полезный", en: "Helpful" },
  "feedback.cat.well_written": { ru: "Хорошо написано", en: "Well written" },
  "feedback.cat.creative": { ru: "Креативный", en: "Creative" },
  "feedback.cat.good_search": { ru: "Хороший поиск", en: "Good search" },
  "feedback.cat.other": { ru: "Другое", en: "Other" },

  // ---- Error messages ----
  "error.rateLimit": { ru: "Достигнут лимит сообщений на сегодня.", en: "Daily message limit reached." },
  "error.guestLimit": { ru: "Лимит гостевых сообщений исчерпан. Войдите, чтобы получить в 2 раза больше.", en: "Guest message limit reached. Sign in to get 2x more messages." },
  "error.loginCta": { ru: "Войти", en: "Sign in" },
  "error.payment": { ru: "Недостаточно средств на балансе.", en: "Insufficient balance." },
  "error.cancelled": { ru: "Запрос отменён.", en: "Request cancelled." },
  "error.generic": { ru: "Произошла ошибка. Попробуйте ещё раз.", en: "Something went wrong. Try again." },
  "error.noResponse": { ru: "Модель не ответила. Попробуйте ещё раз.", en: "Model didn't respond. Try again." },
  "error.upgradeCta": { ru: "Увеличить лимит", en: "Increase limit" },
  "error.topupCta": { ru: "Пополнить баланс", en: "Top up balance" },
  "error.retryAfter": { ru: "Лимит обновится через", en: "Limit resets in" },
  "error.min": { ru: "мин.", en: "min." },

  // ---- Search phases ----
  "search.searching": { ru: "Ищу в интернете", en: "Searching the web" },
  "search.found": { ru: "Найдено", en: "Found" },
  "search.sources": { ru: "источников", en: "sources" },
  "search.label": { ru: "Поиск", en: "Search" },
  // ---- Voice ----
  "voice.listening": { ru: "Слушаю...", en: "Listening..." },
  "voice.thinking": { ru: "Думаю...", en: "Thinking..." },
  "voice.transcribing": { ru: "Распознаю...", en: "Transcribing..." },
  "voice.speaking": { ru: "Отвечаю...", en: "Speaking..." },
  "voice.unsupported": { ru: "Голосовой ввод не поддерживается в этом браузере", en: "Voice input not supported in this browser" },
  "voice.micDenied": { ru: "Доступ к микрофону запрещён", en: "Microphone access denied" },
  "voice.error": { ru: "Ошибка голосового ввода", en: "Voice input error" },
  "voice.loginRequired": { ru: "Войдите в аккаунт для голосового режима", en: "Log in to use voice mode" },
  "voice.close": { ru: "Закрыть", en: "Close" },
  "voice.send": { ru: "Отправить", en: "Send" },
  "voice.mute": { ru: "Выключить микрофон", en: "Mute" },
  "voice.unmute": { ru: "Включить микрофон", en: "Unmute" },
  "voice.end": { ru: "Завершить", en: "End" },

  "search.source": { ru: "источник", en: "source" },

  // ---- External link modal ----
  "external.title": { ru: "Внешняя ссылка", en: "External link" },
  "external.subtitle": { ru: "Вы покидаете Миру", en: "You are leaving Mira" },
  "external.cancel": { ru: "Отмена", en: "Cancel" },
  "external.go": { ru: "Перейти", en: "Continue" },
  "search.sources.label": { ru: "Источники", en: "Sources" },
};

// ---- React Context for reactive locale changes ----

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children, initialLocale = "ru" }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const translate = useCallback((key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[locale] || entry["ru"] || key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale: setLocaleState, t: translate }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// Legacy exports for non-context usage
let _legacyLocale: Locale = "ru";
export function setLocale(l: Locale) { _legacyLocale = l; }
export function getLocale(): Locale { return _legacyLocale; }
export function t(key: string): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[_legacyLocale] || entry["ru"] || key;
}
