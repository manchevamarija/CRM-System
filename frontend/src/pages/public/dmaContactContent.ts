export const services = [
  {
    id: "strategy",
    title: "Дигитална стратегија",
    text: "План за раст и јасни дигитални приоритети.",
    icon: "↗",
  },
  {
    id: "web",
    title: "Веб и е-трговија",
    text: "Веб-страница, портал или онлајн продажба.",
    icon: "◫",
  },
  {
    id: "automation",
    title: "Автоматизација",
    text: "Поедноставување процеси и CRM интеграции.",
    icon: "⚙",
  },
  {
    id: "ai",
    title: "Паметни дигитални решенија",
    text: "Практична автоматизација и подобрување на процесите.",
    icon: "✦",
  },
  {
    id: "marketing",
    title: "Дигитален маркетинг",
    text: "Кампањи, содржина и мерлив раст.",
    icon: "◎",
  },
  {
    id: "training",
    title: "Обуки за тимови",
    text: "Прилагодени практични обуки и менторство.",
    icon: "◉",
  },
] as const;

export const translations: Record<"en" | "sq", Record<string, string>> = {
  en: {
    "КОНТАКТ · CRM SYSTEM": "CONTACT · CRM SYSTEM",
    "Да создадеме нешто": "Let’s create something",
    "вредно заедно.": "valuable together.",
    "Изберете што ви е потребно, составете сопствен пакет на услуги и нашиот тим ќе ве контактира со јасен следен чекор.":
      "Choose what you need, build your own service package and our team will contact you with a clear next step.",
    "Без обврска": "No obligation",
    "Одговор до 2 работни дена": "Reply within 2 business days",
    "Персонализирана понуда": "Personalised offer",
    "КАКО ФУНКЦИОНИРА": "HOW IT WORKS",
    Изберете: "Choose",
    "консултација или соработка": "consultation or partnership",
    Додадете: "Add",
    "услуги во кошничката": "services to your cart",
    Испратете: "Submit",
    "и следете го CRM статусот": "and track the CRM status",
    "Што сакате да започнете?": "What would you like to start?",
    "Изберете една опција. Формуларот ќе се прилагоди според вашето барање.":
      "Choose one option. The form will adapt to your request.",
    "Сакам консултација": "I want a consultation",
    "Разговор со експерт за предизвик или идеја":
      "Talk to an expert about a challenge or idea",
    "Сакам соработка": "I want a partnership",
    "Долгорочно партнерство со CRM System":
      "Long-term cooperation with CRM System",
    "Составете го вашиот пакет": "Build your package",
    "Изберете ги услугите што ве интересираат. Може да одберете повеќе.":
      "Select the services you are interested in. You may choose more than one.",
    "ИЗБРАНИ УСЛУГИ": "SELECTED SERVICES",
    "Вашата кошничка": "Your cart",
    "Изберете услуги": "Choose services",
    "Додадете ги услугите што ви се потребни од листата.":
      "Add the services you need from the list.",
    "Вкупно избрани услуги": "Total selected services",
    "Продолжи кон барањето": "Continue to request",
    "Прво изберете услуга": "Choose a service first",
    "Нема онлајн наплата. По испраќањето, CRM System ќе ве контактира со персонализирана понуда.":
      "No online payment. CRM System will contact you with a personalised offer after submission.",
    "Податоци за соработка": "Partnership details",
    "Кажете ни за вас": "Tell us about yourself",
    "Полињата означени со * се задолжителни.":
      "Fields marked with * are required.",
    "Контакт лице": "Contact person",
    "Име и презиме *": "Full name *",
    "Телефон *": "Phone *",
    "Е-пошта *": "Email *",
    "Префериран контакт": "Preferred contact",
    "Телефонски повик": "Phone call",
    "Онлајн состанок": "Online meeting",
    "Средба во живо": "In-person meeting",
    Организација: "Organisation",
    "Назив на фирма / организација *": "Company / organisation name *",
    Тип: "Type",
    "Мало или средно претпријатие": "Small or medium enterprise",
    Компанија: "Company",
    "Јавна институција": "Public institution",
    "Здружение / НВО": "Association / NGO",
    "Даночен број *": "Tax number *",
    "Матичен број *": "Registration number *",
    "Адреса на седиште *": "Registered address *",
    "Дејност / сектор": "Industry / sector",
    "Број на вработени": "Number of employees",
    Општина: "Municipality",
    "Веб-страница": "Website",
    "Вашите потреби": "Your needs",
    "Кратко опишете го предизвикот или идејата *":
      "Briefly describe the challenge or idea *",
    "Што сакате да подобрите или постигнете?":
      "What would you like to improve or achieve?",
    "Посакуван рок": "Desired timeline",
    "Што е можно поскоро": "As soon as possible",
    "Во следните 1–3 месеци": "Within 1–3 months",
    "Во следните 3–6 месеци": "Within 3–6 months",
    "Само истражувам": "I am only exploring",
    "Ориентациски буџет": "Estimated budget",
    "Сè уште не е дефиниран": "Not defined yet",
    "До 1.000 €": "Up to €1,000",
    "Над 5.000 €": "Over €5,000",
    "1.000–5.000 €": "€1,000–€5,000",
    "Се согласувам CRM System да ме контактира во врска со ова барање.":
      "I agree that CRM System may contact me about this request.",
    "Ја прочитав и ја прифаќам политиката за приватност.":
      "I have read and accept the privacy policy.",
    "Испрати барање": "Submit request",
    "Се испраќа…": "Submitting…",
  },
  sq: {
    "КОНТАКТ · CRM SYSTEM": "KONTAKT · CRM SYSTEM",
    "Да создадеме нешто": "Le të krijojmë diçka",
    "вредно заедно.": "me vlerë së bashku.",
    "Изберете што ви е потребно, составете сопствен пакет на услуги и нашиот тим ќе ве контактира со јасен следен чекор.":
      "Zgjidhni çfarë ju nevojitet, krijoni paketën tuaj dhe ekipi ynë do t’ju kontaktojë me hapin e ardhshëm.",
    "Без обврска": "Pa detyrim",
    "Одговор до 2 работни дена": "Përgjigje brenda 2 ditëve pune",
    "Персонализирана понуда": "Ofertë e personalizuar",
    "КАКО ФУНКЦИОНИРА": "SI FUNKSIONON",
    Изберете: "Zgjidhni",
    "консултација или соработка": "konsultim ose bashkëpunim",
    Додадете: "Shtoni",
    "услуги во кошничката": "shërbime në shportë",
    Испратете: "Dërgoni",
    "и следете го CRM статусот": "dhe ndiqni statusin CRM",
    "Што сакате да започнете?": "Çfarë dëshironi të filloni?",
    "Изберете една опција. Формуларот ќе се прилагоди според вашето барање.":
      "Zgjidhni një opsion. Formulari do të përshtatet me kërkesën tuaj.",
    "Сакам консултација": "Dua konsultim",
    "Разговор со експерт за предизвик или идеја":
      "Bisedë me ekspert për një sfidë ose ide",
    "Сакам соработка": "Dua bashkëpunim",
    "Долгорочно партнерство со CRM System":
      "Partneritet afatgjatë me CRM System",
    "Составете го вашиот пакет": "Krijoni paketën tuaj",
    "Изберете ги услугите што ве интересираат. Може да одберете повеќе.":
      "Zgjidhni shërbimet që ju interesojnë. Mund të zgjidhni disa.",
    "ИЗБРАНИ УСЛУГИ": "SHËRBIMET E ZGJEDHURA",
    "Вашата кошничка": "Shporta juaj",
    "Изберете услуги": "Zgjidhni shërbime",
    "Додадете ги услугите што ви се потребни од листата.":
      "Shtoni nga lista shërbimet që ju nevojiten.",
    "Вкупно избрани услуги": "Gjithsej shërbime të zgjedhura",
    "Продолжи кон барањето": "Vazhdoni te kërkesa",
    "Прво изберете услуга": "Së pari zgjidhni një shërbim",
    "Нема онлајн наплата. По испраќањето, CRM System ќе ве контактира со персонализирана понуда.":
      "Nuk ka pagesë online. CRM System do t’ju kontaktojë me ofertë të personalizuar.",
    "Податоци за соработка": "Të dhënat e bashkëpunimit",
    "Кажете ни за вас": "Na tregoni për ju",
    "Полињата означени со * се задолжителни.":
      "Fushat me * janë të detyrueshme.",
    "Контакт лице": "Personi kontaktues",
    "Име и презиме *": "Emri dhe mbiemri *",
    "Телефон *": "Telefoni *",
    "Е-пошта *": "Email *",
    "Префериран контакт": "Kontakti i preferuar",
    "Телефонски повик": "Telefonatë",
    "Онлајн состанок": "Takim online",
    "Средба во живо": "Takim fizik",
    Организација: "Organizata",
    "Назив на фирма / организација *": "Emri i kompanisë / organizatës *",
    Тип: "Lloji",
    "Мало или средно претпријатие": "Ndërmarrje e vogël ose e mesme",
    Компанија: "Kompani",
    "Јавна институција": "Institucion publik",
    "Здружение / НВО": "Shoqatë / OJQ",
    "Даночен број *": "Numri tatimor *",
    "Матичен број *": "Numri i regjistrimit *",
    "Адреса на седиште *": "Adresa e selisë *",
    "Дејност / сектор": "Veprimtaria / sektori",
    "Број на вработени": "Numri i punonjësve",
    Општина: "Komuna",
    "Веб-страница": "Faqja e internetit",
    "Вашите потреби": "Nevojat tuaja",
    "Кратко опишете го предизвикот или идејата *":
      "Përshkruani shkurt sfidën ose idenë *",
    "Што сакате да подобрите или постигнете?":
      "Çfarë dëshironi të përmirësoni ose arrini?",
    "Посакуван рок": "Afati i dëshiruar",
    "Што е можно поскоро": "Sa më shpejt",
    "Во следните 1–3 месеци": "Brenda 1–3 muajve",
    "Во следните 3–6 месеци": "Brenda 3–6 muajve",
    "Само истражувам": "Vetëm po hulumtoj",
    "Ориентациски буџет": "Buxheti i përafërt",
    "Сè уште не е дефиниран": "Ende i papërcaktuar",
    "До 1.000 €": "Deri në 1.000 €",
    "Над 5.000 €": "Mbi 5.000 €",
    "Се согласувам CRM System да ме контактира во врска со ова барање.":
      "Pajtohem që CRM System të më kontaktojë për këtë kërkesë.",
    "Ја прочитав и ја прифаќам политиката за приватност.":
      "E kam lexuar dhe pranoj politikën e privatësisë.",
    "Испрати барање": "Dërgo kërkesën",
    "Се испраќа…": "Duke dërguar…",
  },
};

Object.assign(translations.en, {
  "Дигитална стратегија": "Digital strategy",
  "План за раст и јасни дигитални приоритети.":
    "A growth plan with clear digital priorities.",
  "Веб и е-трговија": "Web & e-commerce",
  "Веб-страница, портал или онлајн продажба.":
    "A website, portal or online sales solution.",
  Автоматизација: "Automation",
  "Поедноставување процеси и CRM интеграции.":
    "Streamlined processes and CRM integrations.",
  "Паметни дигитални решенија": "Smart digital solutions",
  "Практична автоматизација и подобрување на процесите.":
    "Practical automation and process improvement.",
  "Дигитален маркетинг": "Digital marketing",
  "Кампањи, содржина и мерлив раст.":
    "Campaigns, content and measurable growth.",
  "Обуки за тимови": "Team training",
  "Прилагодени практични обуки и менторство.":
    "Tailored practical training and mentoring.",
  "БАРАЊЕТО Е УСПЕШНО ПРИМЕНО": "REQUEST SUCCESSFULLY RECEIVED",
  "Добредојдовте во CRM System.": "Welcome to CRM System.",
  "Референтен број": "Reference number",
  Пријавен: "Applied",
  Контактирање: "Contacting",
  "Доделен агент": "Assigned agent",
  "Потврдени услуги": "Confirmed services",
  "Во процедура": "In progress",
  Услужен: "Served",
  "Отвори го мојот профил": "Open my profile",
  "Креирај профил за следење": "Create a tracking profile",
  "Назад на почетна": "Back to home",
});
Object.assign(translations.sq, {
  "Дигитална стратегија": "Strategji digjitale",
  "План за раст и јасни дигитални приоритети.":
    "Plan rritjeje me prioritete të qarta digjitale.",
  "Веб и е-трговија": "Ueb dhe tregti elektronike",
  "Веб-страница, портал или онлајн продажба.":
    "Faqe interneti, portal ose shitje online.",
  Автоматизација: "Automatizim",
  "Поедноставување процеси и CRM интеграции.":
    "Thjeshtim procesesh dhe integrime CRM.",
  "Паметни дигитални решенија": "Zgjidhje digjitale inteligjente",
  "Практична автоматизација и подобрување на процесите.":
    "Automatizim praktik dhe përmirësim i proceseve.",
  "Дигитален маркетинг": "Marketing digjital",
  "Кампањи, содржина и мерлив раст.":
    "Fushata, përmbajtje dhe rritje e matshme.",
  "Обуки за тимови": "Trajnime për ekipe",
  "Прилагодени практични обуки и менторство.":
    "Trajnime praktike dhe mentorim të përshtatur.",
  "БАРАЊЕТО Е УСПЕШНО ПРИМЕНО": "KËRKESA U PRANUA ME SUKSES",
  "Добредојдовте во CRM System.": "Mirë se vini në CRM System.",
  "Референтен број": "Numri i referencës",
  Пријавен: "Aplikuar",
  Контактирање: "Në kontaktim",
  "Доделен агент": "Agjent i caktuar",
  "Потврдени услуги": "Shërbime të konfirmuara",
  "Во процедура": "Në proces",
  Услужен: "I shërbyer",
  "Отвори го мојот профил": "Hap profilin tim",
  "Креирај профил за следење": "Krijo profil për ndjekje",
  "Назад на почетна": "Kthehu në ballinë",
});
Object.assign(translations.en, {
  "Барањето е регистрирано.": "Your request is registered.",
  "Вашето барање и избраните услуги се внесени во CRM System CRM. Креирајте профил со истата е-пошта за да ги следите статусите и следните чекори.":
    "Your request and selected services are now in the CRM System CRM. Create an account with the same email to track statuses and next steps.",
  "Вашиот CRM профил и барањето се поврзани. Сите следни чекори можете да ги следите во порталот.":
    "Your CRM profile and request are linked. You can track every next step in the portal.",
  "Ваши избрани услуги": "Your selected services",
  услуга: "service",
  услуги: "services",
  "избрани услуги": "selected services",
  Отстрани: "Remove",
  "Изберете најмалку една услуга за вашата кошничка.":
    "Choose at least one service for your cart.",
  "Барањето не можеше да се испрати. Обидете се повторно.":
    "The request could not be submitted. Please try again.",
  "Профилот не можеше да се креира.": "The profile could not be created.",
  "Креирајте профил веднаш": "Create your profile now",
  "Е-поштата од барањето е веќе внесена. Изберете лозинка и продолжете во порталот.":
    "The email from your request is already entered. Choose a password and continue to the portal.",
  "Е-пошта": "Email",
  "Изберете лозинка (мин. 8 знаци)": "Choose a password (min. 8 characters)",
  "Се креира…": "Creating…",
  "Креирај профил и продолжи": "Create profile and continue",
  "Follow up": "Follow-up",
  "✓ Без обврска": "✓ No obligation",
  "✓ Одговор до 2 работни дена": "✓ Reply within 2 business days",
  "✓ Персонализирана понуда": "✓ Personalised offer",
});
Object.assign(translations.sq, {
  "Барањето е регистрирано.": "Kërkesa juaj është regjistruar.",
  "Вашето барање и избраните услуги се внесени во CRM System CRM. Креирајте профил со истата е-пошта за да ги следите статусите и следните чекори.":
    "Kërkesa dhe shërbimet tuaja janë regjistruar në CRM System CRM. Krijoni llogari me të njëjtin email për të ndjekur statuset dhe hapat vijues.",
  "Вашиот CRM профил и барањето се поврзани. Сите следни чекори можете да ги следите во порталот.":
    "Profili CRM dhe kërkesa juaj janë lidhur. Të gjithë hapat vijues mund t’i ndiqni në portal.",
  "Ваши избрани услуги": "Shërbimet tuaja të zgjedhura",
  услуга: "shërbim",
  услуги: "shërbime",
  "избрани услуги": "shërbime të zgjedhura",
  Отстрани: "Hiq",
  "Изберете најмалку една услуга за вашата кошничка.":
    "Zgjidhni të paktën një shërbim për shportën tuaj.",
  "Барањето не можеше да се испрати. Обидете се повторно.":
    "Kërkesa nuk mund të dërgohej. Ju lutemi provoni përsëri.",
  "Профилот не можеше да се креира.": "Profili nuk mund të krijohej.",
  "Креирајте профил веднаш": "Krijoni profilin tani",
  "Е-поштата од барањето е веќе внесена. Изберете лозинка и продолжете во порталот.":
    "Emaili nga kërkesa është plotësuar. Zgjidhni një fjalëkalim dhe vazhdoni në portal.",
  "Е-пошта": "Email",
  "Изберете лозинка (мин. 8 знаци)": "Zgjidhni fjalëkalim (min. 8 karaktere)",
  "Се креира…": "Duke krijuar…",
  "Креирај профил и продолжи": "Krijo profilin dhe vazhdo",
  "Follow up": "Ndjekje",
  "✓ Без обврска": "✓ Pa detyrim",
  "✓ Одговор до 2 работни дена": "✓ Përgjigje brenda 2 ditëve pune",
  "✓ Персонализирана понуда": "✓ Ofertë e personalizuar",
});
Object.assign(translations.en, {
  "БАРАЊЕТО Е РЕГИСТРИРАНО": "REQUEST REGISTERED",
});
Object.assign(translations.sq, {
  "БАРАЊЕТО Е РЕГИСТРИРАНО": "KËRKESA U REGJISTRUA",
});
