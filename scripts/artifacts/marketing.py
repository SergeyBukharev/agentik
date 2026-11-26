import json
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfReader
from reportlab.graphics.shapes import Circle, Drawing, Ellipse, Line, Rect
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[2]
PAGE_WIDTH = 595
PAGE_HEIGHT = 842
MARGIN = 42
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN - 12

pdfmetrics.registerFont(TTFont('ArialRU', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialRUB', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('ArialRU', normal='ArialRU', bold='ArialRUB', italic='ArialRU', boldItalic='ArialRUB')

palette = json.loads((ROOT / 'design-system/colors.json').read_text(encoding='utf-8'))['light']
INK = colors.HexColor(palette['ink'])
MUTED = colors.HexColor(palette['muted'])
LIME = colors.HexColor(palette['lime'])
LIME_SOFT = colors.HexColor(palette['lime-soft'])
SOFT = colors.HexColor(palette['soft'])
RULE = colors.HexColor(palette['line'])
LINK = palette['focus']

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyRU', fontName='ArialRU', fontSize=10.5, leading=15, textColor=INK, spaceAfter=9))
styles.add(ParagraphStyle(name='WordmarkRU', fontName='ArialRUB', fontSize=21, leading=24, textColor=INK, spaceAfter=26))
styles.add(ParagraphStyle(name='TitleRU', fontName='ArialRUB', fontSize=33, leading=37, textColor=INK, spaceAfter=14))
styles.add(ParagraphStyle(name='HeadRU', fontName='ArialRUB', fontSize=23, leading=27, textColor=INK, spaceAfter=14))
styles.add(ParagraphStyle(name='SubRU', fontName='ArialRUB', fontSize=12, leading=16, textColor=INK, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='SmallRU', fontName='ArialRU', fontSize=9, leading=13, textColor=MUTED, spaceAfter=7))
styles.add(ParagraphStyle(name='CellRU', fontName='ArialRU', fontSize=9.5, leading=13, textColor=INK))
styles.add(ParagraphStyle(name='CellHeadRU', fontName='ArialRUB', fontSize=9.5, leading=13, textColor=INK))


def p(text, style='BodyRU'):
    return Paragraph(text, styles[style])


def h(text):
    return p(text, 'SubRU')


def link(url, label):
    return f'<link href="{escape(url)}" color="{LINK}">{escape(label)}</link>'


def mascot():
    art = Drawing(CONTENT_WIDTH, 165)
    art.add(Ellipse(240, 24, 130, 12, fillColor=SOFT, strokeColor=None))
    art.add(Circle(230, 84, 66, fillColor=SOFT, strokeColor=None))
    art.add(Rect(164, 40, 112, 104, rx=30, fillColor=LIME, strokeColor=INK, strokeWidth=1.3))
    art.add(Rect(180, 68, 80, 51, rx=18, fillColor=INK, strokeColor=None))
    art.add(Rect(198, 85, 9, 18, rx=4, fillColor=LIME, strokeColor=None))
    art.add(Rect(232, 85, 9, 18, rx=4, fillColor=LIME, strokeColor=None))
    art.add(Line(212, 76, 227, 76, strokeColor=LIME, strokeWidth=2))
    art.add(Line(220, 144, 220, 157, strokeColor=INK, strokeWidth=2))
    art.add(Circle(220, 159, 4, fillColor=colors.HexColor('#B6A3D3'), strokeColor=None))
    art.add(Rect(300, 65, 55, 68, rx=8, fillColor=colors.white, strokeColor=RULE))
    for y in (115, 102, 89):
        art.add(Line(311, y, 343, y, strokeColor=MUTED, strokeWidth=2))
    art.add(Circle(124, 102, 6, fillColor=colors.HexColor('#EAC9B2'), strokeColor=None))
    art.add(Line(363, 141, 363, 161, strokeColor=colors.HexColor('#8F79AE'), strokeWidth=2))
    art.add(Line(353, 151, 373, 151, strokeColor=colors.HexColor('#8F79AE'), strokeWidth=2))
    return art


def table(rows, widths):
    assert sum(widths) == CONTENT_WIDTH
    cells = [[p(text, 'CellHeadRU' if index == 0 else 'CellRU') for text in row] for index, row in enumerate(rows)]
    grid = Table(cells, colWidths=widths, hAlign='LEFT', repeatRows=1)
    grid.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), LIME_SOFT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -1), .5, RULE),
    ]))
    return grid


def note(text):
    panel = Table([[p(text, 'CellRU')]], colWidths=[CONTENT_WIDTH], hAlign='LEFT')
    panel.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SOFT),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 11),
    ]))
    return panel


pages = [
    [
        p('agentik', 'WordmarkRU'),
        p('Продуктовая и<br/>маркетинговая стратегия', 'TitleRU'),
        p('План первого продуктового пилота · 26 ноября 2026', 'SmallRU'),
        mascot(),
        h('Кому и зачем'),
        p('Agentik помогает выбрать AI-помощника под конкретное дело, начать с готового запроса и вернуться к разговору. '
          'Проверяем, где такой вход помогает завершить задачу и где люди возвращаются к результату.'),
        h('Что уже можно показать'),
        p('В прототипе работают каталог с поиском и примерами, избранное, свои помощники и история. '
          'В чате «Семейный финансист» есть семейный бюджет. В личном чате можно открыть доску документов.'),
        p('Локальные группы подходят для демонстрации в одном браузере. Комплект Telegram Mini App содержит веб-сборку, '
          'сервер и виджет для чтения копии чата по ссылке. Запуск на рабочем боте предстоит подтвердить.'),
        Spacer(1, 10),
        note('Технические проверки описывают работу прототипа. Пользовательские и коммерческие показатели '
             'предстоит собрать. Пороги предлагаем утвердить до исследования.'),
    ],
    [
        p('Аудитория и задачи', 'HeadRU'),
        p('Подбираем участников по недавней реальной задаче и по тому, как они решают её сейчас.'),
        table([
            ('Кого приглашаем', 'Задача участника', 'Что измеряем'),
            ('Ведёт домашние расходы', '«Когда оплачу счета, хочу понять, сколько осталось на каждый день».',
             '≥70% начавших задание с модератором вносят доход, платёж и покупку и объясняют сумму на день.'),
            ('Готовит материалы в небольшой команде', '«Хочу собрать PDF, DOCX и заметки и получить выжимку с проверяемыми фактами».',
             '≥60% вошедших получают пригодный результат за 24 часа. ≥80% существенных фактов в парном тесте верны и прослеживаются до источников.'),
            ('Решает разные рабочие и бытовые задачи', '«Хочу выбрать подходящую роль и пример запроса, чтобы сделать первый черновик».',
             '≥70% вошедших выбирают роль без подсказки и получают пригодный черновик за 24 часа. '
             'Проверяем бриф для дизайна, продуктовые и бытовые задачи.'),
        ], [126, 173, 200]),
        h('Первый результат и возврат'),
        p('Для документов и профильного помощника сравниваем одинаковые задачи с обычным чатом без заданной роли. '
          'Цель по медианному времени до первого пригодного результата - снижение на ≥20% при сопоставимом качестве. '
          'Учитываем долю успешных попыток в каждом варианте.'),
        p('<b>A24</b> = участники с первым полезным результатом за 24 часа / вошедшие с полным окном. '
          '<b>D7</b> = участники, продолжившие или повторившие задачу в другой день за неделю / участники с первым '
          'полезным результатом и полным окном. Порог D7 ≥30% в каждой когорте.'),
        h('Основание для выбора задач'),
        p('В исследовании потребительских планов ChatGPT около трёх четвертей разговоров приходились '
          'на практические советы, поиск информации и работу с текстом. '
          + link('https://openai.com/index/how-people-are-using-chatgpt/', 'Исследование OpenAI'), 'SmallRU'),
    ],
    [
        p('Интерфейс и площадки', 'HeadRU'),
        table([
            ('Сценарий', 'Что входит в прототип'),
            ('Старт и история', 'Категории, поиск, избранное, примеры запросов и сохранённые чаты. Режим AI требует настроенного сервера. '
             'Сессия после входа по коду действует 90 дней. Каталог, история, демочат и локальные комнаты доступны после установки офлайн-кеша.'),
            ('Семейный бюджет', '«Семейный финансист» → «Семейный бюджет». В профиле сохраняются месячный доход, покупки и обязательные платежи. '
             'Таблица показывает остаток и сумму на день.'),
            ('Доска документов', 'Вкладка «Доска» сохраняет оригиналы в браузере. Текстовые PDF, DOCX и заметки дают фрагменты для редактируемого '
             'запроса на выжимку, сравнение или извлечение данных. Для сканов доступен оригинал. OCR отсутствует.'),
            ('Локальная группа', 'Приглашение и отзыв участия работают между профилями одного браузера. '
             'Обмен сообщениями между устройствами требует будущей серверной синхронизации.'),
        ], [132, 367]),
        h('Публичный сайт и рабочее превью'),
        p('GitHub Pages показывает лендинг и киты. Рабочие демочаты доступны владельцу в закрытом Sites-превью '
          'после проверки ChatGPT и входа Agentik. В бренд-ките для двух вариантов логотипа доступны копирование SVG '
          'и выгрузка PNG 1× и 2×. Палитра скачивается в JSON, исходные SVG и описание находятся в пресс-ките.'),
        p(link('https://sergeybukharev.github.io/agentik/', 'GitHub Pages') + ' · '
          + link('https://sergeybukharev.github.io/agentik/#/ui-kit', 'UI-кит') + ' · '
          + link('https://sergeybukharev.github.io/agentik/#/brand-kit', 'Бренд-кит') + ' · '
          + link('https://sergeybukharev.github.io/agentik/#/press-kit', 'Пресс-кит'), 'SmallRU'),
        h('Что проверяем на мобильном'),
        p('Нижняя навигация, стартовые запросы и список недавних чатов опираются на интерфейсные референсы. '
          'На тестах проверяем ширину от 320 CSS px, экранную клавиатуру, черновик после ошибки, скелетоны и системное уменьшение движения.'),
        p(link('https://mobbin.com/screens/26343f18-20a1-4140-8b6e-769ab72bde3f', 'Character AI · каталог') + ' · '
          + link('https://mobbin.com/screens/ff123a05-48c8-438d-971e-357c1a18e028', 'Character AI · начало диалога') + ' · '
          + link('https://mobbin.com/screens/fbd4427a-94db-4ed8-908c-6d015b246ac1', 'Meta AI · история'), 'SmallRU'),
    ],
    [
        p('Передача чата в Telegram', 'HeadRU'),
        p('Чтобы передать контекст, отправитель создаёт копию личного или группового чата и открывает официальный '
          'выбор чата Telegram через t.me/share/url. Ссылка с параметром startapp запускает компактный Mini App и '
          'показывает до 50 последних сообщений только для чтения. Изображения представлены отметками о вложении.'),
        p('Ссылка действует 24 часа. Отправитель может отозвать её или выпустить новую. '
          'Комплект содержит веб-сборку и Node API. Проверку на рабочем боте и в реальных клиентах Telegram предстоит провести.'),
        h('Воронка пилота'),
        p('После проверки Android, iOS и десктопа запланировать 20 пар, по одной основной ссылке на пару. '
          'Открытие выбора чата измеряем отдельно. Доставку подтверждает получатель.'),
        table([
            ('Шаг', 'Числитель / знаменатель', 'Порог'),
            ('Создана копия', 'Попытки с выпущенной ссылкой / попытки с открытым диалогом публикации', '≥80%'),
            ('Открыт выбор чата', 'Ссылки с открытым выбором чата Telegram / выпущенные ссылки', '≥60%'),
            ('Открыта получателем', 'Уникальные ссылки с загрузкой хотя бы у одного получателя за 24 часа / уникальные выпущенные ссылки с полным окном', '≥25%'),
            ('Виджет загрузился', 'Успешные загрузки / первые открытия по действующим ссылкам в поддерживаемом клиенте', '≥90%'),
            ('Получен контекст', 'Получатели, нашедшие заданный факт / получатели, открывшие копию в парном тесте', '≥70%'),
        ], [124, 299, 76]),
        h('Контроль доступа'),
        p('В техническом тесте все отозванные и истёкшие ссылки должны стать недоступны при повторном открытии. '
          'Аналитика использует псевдонимы попыток и статусы. Ссылки доступа, содержимое и данные авторизации в неё не передаются.'),
        p(link('https://core.telegram.org/widgets/share', 'Telegram Sharing Button') + ' · '
          + link('https://core.telegram.org/bots/webapps#direct-link-mini-apps', 'Telegram Mini Apps и compact mode'), 'SmallRU'),
    ],
    [
        p('Порядок пилота и решения', 'HeadRU'),
        p('Для приглашения в пилот используем публичную страницу и демонстрации одной задачи. '
          'Профессиональные и тематические сообщества подходят для поиска участников с согласия модераторов. '
          'Каналы помечаем отдельными ссылками и оцениваем по завершённым задачам и возврату.'),
        table([
            ('Неделя', 'Эксперимент'),
            ('1 · Понять задачу', 'Запланировать 8-10 интервью о недавних задачах и 5-8 наблюдаемых мобильных сессий.'),
            ('2 · Проверить сценарии', 'Исправить повторяющиеся ошибки. Провести парные сравнения на одинаковых источниках и задачах.'),
            ('3 · Провести пилот', 'Набрать по 20 участников на направление. Проверить A24 и собрать данные на D7. '
             'Подключить пилот Telegram после проверки бота и HTTPS-развёртывания.'),
            ('4 · Выбрать фокус', 'Сопоставить возврат, качество и затраты на успешную задачу. Выбрать следующую версию сценария.'),
        ], [131, 368]),
        h('Free, PRO и будущие платежи'),
        p('Free включает два пробных сообщения на аккаунт. Экран PRO открывается после второй принятой отправки. '
          'Демо PRO выдаётся через серверную настройку. Реальный приём платежей пока не запущен.'),
        p('Сравнить показ после второй отправки с контрольным показом после третьей. Цель - ≥10% добровольных заявок среди '
          'увидевших раннее предложение. Падение доли продолживших работу допустимо до 5 п.п. '
          'Знаменатель в обеих группах - участники со второй отправкой и полными семью днями после неё.'),
        p('Для будущей продажи цифрового доступа в Telegram нужны Telegram Stars (XTR). '
          + link('https://core.telegram.org/bots/payments-stars', 'Правила Telegram Stars'), 'SmallRU'),
        h('Когда менять направление'),
        p('Если бюджет даёт повтор, проверить отдельный вход к расчёту и расходам. Если доска ускоряет работу с источниками, '
          'вынести загрузку документа в первый шаг. Каталог сохраняем широким при повторяемом результате в нескольких типах задач.'),
        p('Сопутствующая модель юнит-экономики хранит сценарные допущения. '
          'Решение о платном привлечении принимаем после данных о повторном использовании, стоимости запроса и интересе к PRO. '
          'Спрос на межустройственную совместную работу проверяем отдельным пилотом.', 'SmallRU'),
    ],
]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.line(MARGIN, 43, PAGE_WIDTH - MARGIN, 43)
    canvas.setFont('ArialRU', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 28, 'agentik · План пилота · 26.11.2026')
    canvas.drawRightString(PAGE_WIDTH - MARGIN, 28, f'{doc.page} / {len(pages)}')
    canvas.restoreState()


def build():
    story = []
    for page in pages:
        if story:
            story.append(PageBreak())
        story.extend(page)

    path = ROOT / 'docs/marketing-strategy.pdf'
    doc = SimpleDocTemplate(
        str(path), pagesize=(PAGE_WIDTH, PAGE_HEIGHT), leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=40, bottomMargin=56, title='Agentik. Продуктовая и маркетинговая стратегия', author='Agentik',
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)

    reader = PdfReader(path)
    assert len(reader.pages) == len(pages), f'Unexpected number of pages: {len(reader.pages)}'
    assert all(len(page.extract_text()) > 300 for page in reader.pages)
    print(f'PDF saved; {len(reader.pages)} pages with extractable text.')


if __name__ == '__main__':
    build()
