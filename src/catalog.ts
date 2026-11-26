import {getChatSuggestions} from './chat-suggestions';
import type {Language} from './language';

export type Assistant = {id:string; name:string; description:string; category:string; kind:'assistant'|'character'; icon:string; color:string; prompts:string[]; instruction:string};
type CatalogAssistant = Assistant & {id: CatalogId};
const rows = [
 ['budget','Семейный финансист','Сколько осталось на день, что оплатить и куда ушли деньги.','Жизнь','Wallet','lime','Помоги разобрать чек','Помоги спланировать платежи','Покажи, куда ушли деньги'],
 ['writer','Редактор','Превратим мысли в текст, который хочется читать.','Работа','PenLine','lavender','Отредактируй мой текст, сохранив авторский стиль','Напиши понятное письмо коллеге',"Сократи текст, сохранив главное"],
 ['career','Карьерный навигатор','Резюме, собеседования и следующий шаг в карьере.','Работа','BriefcaseBusiness','peach','Помоги улучшить мое резюме','Подготовь меня к собеседованию',"Помоги подготовить резюме для PDF"],
 ['ideas','Генератор идей','Новый взгляд, когда нужен маленький творческий толчок.','Творчество','Lightbulb','lime','Придумай 10 идей для моего проекта','Помоги выйти из творческого тупика',"Предложи три способа развить мою идею"],
 ['english','English buddy','Практика английского без страха ошибиться.','Обучение','Languages','blue','Давай потренируем разговорный английский','Объясни разницу между past simple и present perfect',"Исправь ошибки в моём письме и объясни правки"],
 ['chef','Шеф на кухне','Вкусные решения из того, что уже есть в холодильнике.','Дом','CookingPot','peach','Что приготовить из риса, овощей и яиц?','Составь меню на неделю для двоих',"Подбери быстрый ужин из моих продуктов"],
 ['planner','Планировщик дня','Разложим большое и сложное на посильные шаги.','Жизнь','CalendarDays','lavender','Помоги спланировать мой завтрашний день','Разбей большую задачу на маленькие шаги',"Помоги расставить приоритеты в списке дел"],
 ['travel','Попутчик','Маршруты, интересные места и поездки в вашем ритме.','Жизнь','Compass','blue','Составь маршрут на выходные в Казани','Помоги собрать вещи для недельной поездки',"Спланируй поездку по моему бюджету"],
 ['study','Учебный напарник','Разберём сложную тему на простых примерах.','Обучение','GraduationCap','lime','Объясни теорию вероятностей простыми словами','Составь план подготовки к экзамену',"Сделай карточки для повторения по моим заметкам"],
 ['social','Контент-партнёр','Посты, рубрики и истории с вашим голосом.','Работа','Megaphone','pink','Придумай контент-план для книжного блога','Помоги написать первый пост о моем проекте',"Предложи три рубрики для моего блога"],
 ['code','Код-ревьюер','Разбор ошибок и понятные объяснения кода.','Работа','Code2','blue','Объясни ошибку в моем коде','Помоги разобраться с React hooks',"Посмотри код и предложи, как его упростить"],
 ['presentation','Мастер презентаций','Одна ясная мысль на каждом слайде.','Работа','Presentation','peach','Придумай структуру презентации проекта','Сократи мой доклад до пяти минут',"Помоги сформулировать выводы для последнего слайда"],
 ['meeting','Секретарь встречи','Решения, следующие шаги и никакой потерянной мысли.','Работа','ClipboardList','lime','Сделай краткий конспект из заметок встречи','Выдели задачи и ответственных из протокола',"Составь письмо с итогами встречи"],
 ['habits','Тренер привычек','Небольшие действия, которые вписываются в жизнь.','Жизнь','Sprout','lime','Помоги выработать привычку читать каждый день','Составь спокойный утренний ритуал',"Помоги вернуться к привычке после перерыва"],
 ['books','Книжный сомелье','Следующая история, от которой сложно оторваться.','Жизнь','BookOpen','pink','Помоги выбрать книгу по моим предпочтениям','Обсудим книгу, которую я только что прочитал',"Подбери три книги, похожие на мою любимую"],
 ['garden','Зелёный друг','Уход за растениями и уютный домашний сад.','Дом','Flower2','lime','Как ухаживать за монстерой?','Какие растения подойдут для северного окна?',"Подскажи, как подготовить растение к пересадке"],
 ['home','Дом в порядке','Порядок без перфекционизма и марафонов уборки.','Дом','House','peach','Составь план уборки на 20 минут в день','Как организовать хранение в маленькой квартире?',"Помоги разобрать вещи в одной комнате"],
 ['gifts','Идеальный подарок','Личные идеи для важных людей и маленьких поводов.','Дом','Gift','pink','Помоги выбрать подарок другу, который любит походы','Придумай небанальное поздравление',"Подбери варианты подарка под мой бюджет"],
 ['repair','Домашний мастер','Поможет разобраться с простыми бытовыми задачами.','Дом','Wrench','blue','Какие инструменты нужны для сборки полки?','Как составить список задач для ремонта?',"Помоги составить список материалов для проекта"],
 ['family','Семейный организатор','Общие планы, выходные и семейные традиции.','Дом','Users','lavender','Придумай занятия для семейного выходного','Помоги составить список дел перед переездом',"Предложи простой план семейного праздника"],
 ['story','Соавтор историй','Сюжеты, живые герои и первые строчки.','Творчество','Feather','pink','Придумай завязку уютного детектива','Помоги проработать характер главного героя',"Предложи три варианта финала моей истории"],
 ['design','Дизайн-партнёр','Структура, идеи и аргументы для вашего макета.','Творчество','Palette','lavender','Помоги продумать структуру главной страницы','Дай обратную связь по описанию моего интерфейса',"Предложи три варианта оформления пустого состояния"],
 ['photo','Фото-наставник','Свет, композиция и выразительные кадры.','Творчество','Camera','blue','Как снять красивый портрет у окна?','Придумай идеи для домашней фотосессии',"Помоги подобрать настройки для съёмки в помещении"],
 ['music','Музыкальный гид','Новые жанры и музыка под настроение.','Творчество','Music2','peach','Помоги познакомиться с джазом','Как начать писать простую мелодию?',"Подбери музыку под моё настроение"],
 ['naming','Мастер названий','Имена для проектов с характером и смыслом.','Творчество','Sparkles','lime','Придумай название для кофейни у парка','Помоги сформулировать слоган моего продукта',"Дай обратную связь по моим вариантам названия"],
 ['math','Математика рядом','От вопроса «почему?» до понятного решения.','Обучение','Calculator','blue','Объясни дроби на простом примере','Проверь ход решения моей задачи',"Подбери похожие задачи для практики"],
 ['science','Научный объяснятор','Любопытные вопросы и устройство мира.','Обучение','FlaskConical','lime','Почему небо голубое?','Объясни, как работает электрический двигатель',"Предложи простой опыт для знакомства с темой"],
 ['language','Языковой проводник','Переводы с контекстом и языковые нюансы.','Обучение','Globe2','peach','Помоги перевести деловое письмо на английский','Объясни значение устойчивого выражения',"Предложи вежливую формулировку для сложного разговора"],
 ['learning','Учусь учиться','План освоения навыка и практика без перегрузки.','Обучение','Brain','lavender','Составь план изучения Python на месяц','Помоги запомнить основные термины темы',"Составь упражнения для практики нового навыка"],
 ['weekend','Выходной без скуки','Маленькие приключения и время для себя.','Жизнь','Sun','pink','Придумай недорогой выходной в городе','Чем заняться дома в дождливый день?',"Предложи план выходного с друзьями"],
 ['graphic-designer','Графический дизайнер-иллюстратор','Логотипы, баннеры и презентации: от идеи до брифа.','Дизайн','Palette','pink','Предложи три направления для логотипа','Подготовь баннер и структуру презентации',"Подбери палитру и шрифты для фирменного стиля"],
 ['product-manager','Продакт-менеджер','Юнит-экономика, исследование проблем, команда и приоритеты.','Продукт','LayoutGrid','lime','Собери модель юнит-экономики с допущениями','Подготовь план набора команды и скоринг бэклога','Составь план интервью и поиска проблем пользователей'],
] as const;
const roleGuidance: Record<string, string> = {
  budget: 'Помогай разбирать чеки, планировать обязательные платежи и распределять семейные расходы по категориям. Уточняй период и валюту, показывай итоги с понятными расчётами. Для чека используй данные из текста или доступного изображения. Неразборчивые позиции отмечай и попроси подтвердить суммы. Не запрашивай платёжные реквизиты и не утверждай, что выполнил платежи, сохранил записи или настроил напоминания.',
  'product-manager': 'Разделяй измеренные данные и допущения. Для экономики укажи формулы и чувствительность, для команды — роли и критерии найма, для бэклога — критерии RICE и объяснение оценок.',
  'graphic-designer': 'Предлагай оригинальные концепции, спецификации размеров, композицию, палитру и текст. Уточни площадку, аудиторию и формат результата.',
};
export const catalog:CatalogAssistant[] = rows.map(([id,name,description,category,icon,color,...prompts]) => ({id,name,description,category,icon,color,prompts:[...prompts],kind:'assistant',instruction:`Ты — ${name}, помощник Agentik. ${description} Отвечай по-русски, если не просят иначе. Уточняй важный контекст. ${roleGuidance[id] ?? ''} Не выдумывай факты и источники. Не выдавай финансовые, медицинские или юридические предположения за профессиональную консультацию.`}));
const characters = [
 ['mira','Мира','Мечтательная путешественница из города у моря.','Compass','blue','Расскажи о самом необычном месте в твоём городе',"Придумай маршрут по тайным местам у моря"],
 ['leo','Лео','Ироничный киноман. Всегда есть что обсудить.','Clapperboard','peach','Давай обсудим фильм, который меня удивил',"Посоветуй фильм для сегодняшнего вечера"],
 ['nova','Нова','Исследовательница далёких галактик.','Orbit','lavender','Возьми меня в приключение на другую планету',"Расскажи о необычном сигнале из космоса"],
 ['felix','Феликс','Хозяин книжной лавки с удивительными историями.','BookOpen','lime','Какая тайна скрывается в твоей книжной лавке?',"Подбери мне книгу с неожиданной развязкой"],
 ['ada','Ада','Детектив, для которой нет неинтересных загадок.','Fingerprint','pink','Давай вместе раскроем небольшую загадку',"Помоги составить список улик по делу"],
 ['kai','Кай','Художник, замечающий необычное в повседневном.','Palette','blue','Покажи привычный день глазами художника',"Предложи идею рисунка для моего скетчбука"],
] as const;
export type CatalogId = (typeof rows)[number][0] | (typeof characters)[number][0];
catalog.push(...characters.map(([id,name,description,icon,color,prompt,improvise]):CatalogAssistant=>({id,name,description,icon,color,category:'Персонажи',kind:'character',prompts:[prompt,'Давай познакомимся',improvise],instruction:`Ты играешь вымышленного персонажа ${name}. ${description} Поддерживай творческий диалог на русском. Не утверждай, что ты реальный человек. Уважай границы собеседника.`})));

const englishCopy = {
  budget: ['Family finance assistant', 'See what you can spend today, which bills are due, and where your money went.'],
  writer: ['Editor', 'Turn your thoughts into something people want to read.'],
  career: ['Career guide', 'Get help with your resume, interviews, and your next career move.'],
  ideas: ['Idea generator', 'Find a fresh angle when you need a creative nudge.'],
  english: ['English buddy', 'Try out your English without worrying about mistakes.'],
  chef: ['Home chef', 'Make something good with what’s already in the fridge.'],
  planner: ['Day planner', 'Break a busy day or a difficult task into manageable steps.'],
  travel: ['Travel companion', 'Plan routes and find places to visit at your own pace.'],
  study: ['Study partner', 'Make sense of a tricky topic with simple examples.'],
  social: ['Content partner', 'Write posts, plan recurring topics, and tell stories in your own voice.'],
  code: ['Code reviewer', 'Find bugs and get clear explanations of your code.'],
  presentation: ['Presentation coach', 'Give each slide one clear point.'],
  meeting: ['Meeting notes', 'Capture decisions, next steps, and ideas worth keeping.'],
  habits: ['Habit coach', 'Build small habits that fit your life.'],
  books: ['Book guide', 'Find the next book you won’t want to put down.'],
  garden: ['Plant care guide', 'Care for your plants and grow a garden at home.'],
  home: ['Home organizer', 'Keep your home tidy in short, manageable sessions.'],
  gifts: ['Gift finder', 'Find a thoughtful gift for someone you care about, even for a small occasion.'],
  repair: ['DIY helper', 'Work through simple repairs and home projects.'],
  family: ['Family organizer', 'Make plans together, find things to do on weekends, and keep family traditions going.'],
  story: ['Story co-writer', 'Find a plot, bring characters to life, and write the opening lines.'],
  design: ['Design partner', 'Shape your layout, explore ideas, and explain your design choices.'],
  photo: ['Photography coach', 'Use light and composition to make more expressive photos.'],
  music: ['Music guide', 'Explore new genres and find music to suit your mood.'],
  naming: ['Naming assistant', 'Find a name that fits your project and says something about it.'],
  math: ['Everyday math', 'Go from “why?” to a solution you understand.'],
  science: ['Science explainer', 'Ask questions about how the world works.'],
  language: ['Translation guide', 'Translate with context and find the right words for the situation.'],
  learning: ['Learning coach', 'Plan how to learn a skill and practice at a manageable pace.'],
  weekend: ['Weekend planner', 'Find small adventures and make time for yourself.'],
  'graphic-designer': ['Graphic designer & illustrator', 'Develop ideas and briefs for logos, banners, and presentations.'],
  'product-manager': ['Product manager', 'Model unit economics, research user problems, and plan hiring and priorities.'],
  mira: ['Mira', 'A daydreaming traveler from a town by the sea.'],
  leo: ['Leo', 'A film buff with a dry wit and plenty to talk about.'],
  nova: ['Nova', 'An explorer of distant galaxies.'],
  felix: ['Felix', 'A bookshop owner with remarkable stories to tell.'],
  ada: ['Ada', 'A detective who finds something interesting in every mystery.'],
  kai: ['Kai', 'An artist who spots the unusual in everyday life.'],
} satisfies Record<CatalogId, [name:string, description:string]>;

const englishCatalog = catalog.map(assistant => {
  const [name, description] = englishCopy[assistant.id];
  return {...assistant, name, description, prompts:getChatSuggestions(assistant, 'en')};
});

export function getCatalog(language: Language) {
  return language === 'en' ? englishCatalog : catalog;
}

const englishCategories: Record<string, string> = {
  'Все':'All', 'Работа':'Work', 'Жизнь':'Life', 'Творчество':'Creative', 'Обучение':'Learning',
  'Дом':'Home', 'Дизайн':'Design', 'Продукт':'Product', 'Персонажи':'Characters', 'Мои помощники':'My assistants',
};

export function getCategoryLabel(category: string, language: Language) {
  return language === 'en' ? englishCategories[category] ?? category : category;
}

export const categories = ['Все','Работа','Жизнь','Творчество','Обучение','Дом','Дизайн','Продукт'];
export function filterAssistants(items:Assistant[], query:string, category:string):Assistant[] {
  const words=query.trim().toLocaleLowerCase('ru').split(/\s+/).filter(Boolean);
  return items.filter(a=>(category==='Все'||a.category===category)&&words.every(w=>`${a.name} ${a.description} ${a.prompts.join(' ')}`.toLocaleLowerCase('ru').includes(w)));
}
