// Exemples concrets affichés sous chaque champ (« Ex. : … »). Recherche : type.groupe.champ, groupe.champ, type.champ, champ.
import { t } from "./model.js";

const map = {
        // ---------------------------------------------------------------- Champs communs
        "institution": t("Université de Yaoundé I – Faculté des Sciences", "University of Yaoundé I – Faculty of Science", "جامعة ياوندي 1 – كلية العلوم"),
        "authors": t("ONANA Carine\nBELLO Amina\nMBARGA Paul", "ONANA Carine\nBELLO Amina\nMBARGA Paul", "أونانا كارين\nبيلو أمينة\nمبارغا بول"),
        "author": t("ATANGANA Brice", "ATANGANA Brice", "أتانغانا بريس"),
        "supervisor": t("Dr MBALLA Pierre", "Dr Pierre MBALLA", "د. بيار مبالا"),
        "org": t("Association des étudiants de la FS", "Science Students' Association", "جمعية طلبة كلية العلوم"),
        "city": t("Yaoundé", "Yaoundé", "ياوندي"),
        "conclusion": t("Ce travail nous a permis de comprendre… En perspective, il serait intéressant de…", "This work helped us understand… Going further, it would be useful to…", "سمح لنا هذا العمل بفهم… وكآفاق، سيكون من المفيد…"),
        "intro": t("Le paludisme reste la première cause de consultation au Cameroun. Ce travail présente…", "Malaria remains the leading cause of medical visits in Cameroon. This work presents…", "تبقى الملاريا السبب الأول للاستشارات الطبية في الكاميرون. يقدم هذا العمل…"),
        "references": t("OMS (2024). Rapport mondial sur le paludisme. Genève.\nDupont J. (2021). Biologie cellulaire. Dunod.", "WHO (2024). World Malaria Report. Geneva.\nSmith J. (2021). Cell Biology. Wiley.", "منظمة الصحة العالمية (2024). التقرير العالمي عن الملاريا. جنيف."),
        "subject": t("Demande de stage académique", "Request for an academic internship", "طلب تدريب أكاديمي"),
        "body": t("J'ai l'honneur de solliciter auprès de votre haute bienveillance…\n\nEn effet, étudiant(e) en…", "I am writing to kindly request…\n\nAs a student in…", "يشرفني أن ألتمس من سيادتكم…\n\nبصفتي طالبًا في…"),
        "salutation": t("Monsieur le Directeur,", "Dear Director,", "السيد المدير،"),
        "sender": t("MBARGA Paul", "Paul MBARGA", "بول مبارغا"),
        "sender_address": t("BP 812 Yaoundé\nQuartier Ngoa-Ekellé", "PO Box 812 Yaoundé\nNgoa-Ekellé", "ص.ب 812 ياوندي\nحي نغوا إيكيلي"),
        "sender_phone": t("+237 6 70 00 00 00", "+237 6 70 00 00 00", "+237 6 70 00 00 00"),
        "sender_email": t("paul.mbarga@exemple.cm", "paul.mbarga@example.com", "paul.mbarga@example.com"),
        "recipient": t("Monsieur le Directeur Général\nde la Société CAMTEL\nYaoundé", "The General Manager\nCAMTEL\nYaoundé", "السيد المدير العام\nلشركة كامتل\nياوندي"),
        "attachments": t("Copie de la carte d'étudiant\nCurriculum vitae\nRelevés de notes", "Copy of student card\nCV\nTranscripts", "نسخة من بطاقة الطالب\nالسيرة الذاتية\nكشوف النقاط"),
        "copies": t("Chef du personnel\nArchives", "Head of HR\nFiles", "رئيس الموظفين\nالأرشيف"),
        "number": t("024/2026/DG/SG", "024/2026/DG/SG", "024/2026/م.ع"),
        "signatory": t("Dr ATANGANA Marie", "Dr Marie ATANGANA", "د. ماري أتانغانا"),
        "signatory_function": t("Directrice des Ressources Humaines", "Human Resources Director", "مديرة الموارد البشرية"),

        // ---------------------------------------------------------------- Compte rendu de TP
        "tp.objectives": t("Déterminer la concentration d'une solution d'acide chlorhydrique par titrage avec une solution de soude de concentration connue.", "Determine the concentration of a hydrochloric acid solution by titration with a sodium hydroxide solution of known concentration.", "تحديد تركيز محلول حمض الهيدروكلوريك بالمعايرة بمحلول هيدروكسيد الصوديوم معلوم التركيز."),
        "tp.principle": t("Au point d'équivalence, la quantité d'ions OH⁻ versée est égale à la quantité d'ions H₃O⁺ initialement présents : Ca × Va = Cb × Vb.", "At equivalence, the amount of OH⁻ added equals the amount of H₃O⁺ initially present: Ca × Va = Cb × Vb.", "عند نقطة التكافؤ، كمية أيونات OH⁻ المضافة تساوي كمية أيونات H₃O⁺ الموجودة: Ca × Va = Cb × Vb."),
        "tp.materials": t("Burette graduée de 25 mL\nBécher de 100 mL\npH-mètre\nAgitateur magnétique", "25 mL graduated burette\n100 mL beaker\npH meter\nMagnetic stirrer", "سحاحة مدرجة 25 مل\nكأس 100 مل\nمقياس pH\nخلاط مغناطيسي"),
        "tp.protocol": t("Rincer et remplir la burette avec la soude\nPrélever 10 mL d'acide dans le bécher\nVerser la soude mL par mL en relevant le pH", "Rinse and fill the burette with NaOH\nPour 10 mL of acid into the beaker\nAdd NaOH 1 mL at a time and record the pH", "اشطف السحاحة واملأها بالصودا\nخذ 10 مل من الحمض في الكأس\nأضف الصودا ملًا ملًا وسجل pH"),
        "tp.measures": t("Volume (mL) ; pH\n0 ; 1,2\n5 ; 1,8\n10 ; 7,0\n15 ; 11,9", "Volume (mL) ; pH\n0 ; 1.2\n5 ; 1.8\n10 ; 7.0\n15 ; 11.9", "الحجم (مل) ; pH\n0 ; 1.2\n5 ; 1.8\n10 ; 7.0"),

        "tp.course": t("TP Physique 232", "Physics lab 232", "أعمال تطبيقية فيزياء 232"),
        "tp.title": t("Plan incliné", "Inclined plane", "المستوى المائل"),
        "tp.supervisor": t("Dr WAMBA Claudin", "Dr Claudin WAMBA", "د. كلودان وامبا"),
        "tp.abstract": t("This experiment investigates the motion of an object on an inclined plane…", "This experiment investigates the motion of an object on an inclined plane…", "This experiment investigates the motion of an object on an inclined plane…"),
        "tp.resume": t("Cette manipulation porte sur le mouvement d'un objet sur un plan incliné, avec pour objectif de vérifier…", "This experiment studies the motion of an object on an inclined plane, in order to check…", "تتناول هذه التجربة حركة جسم على مستوى مائل بهدف التحقق من…"),
        "tp.intro": t("L'histoire du plan incliné est liée à celle de la mécanique. Galilée l'a utilisé pour étudier la chute des corps…", "The inclined plane is linked to the history of mechanics. Galileo used it to study falling bodies…", "يرتبط المستوى المائل بتاريخ الميكانيك، وقد استعمله غاليلي لدراسة سقوط الأجسام…"),
        "tp.results": t("On obtient α = (11,12 ± 0,01)° et, d'après la pente du graphe, a = 0,70 m.s⁻².", "We find α = (11.12 ± 0.01)° and, from the slope, a = 0.70 m/s².", "نحصل على α = 11.12° ومن الميل a = 0.70 م/ث²."),
        "tp.analysis": t("La valeur expérimentale est inférieure à la valeur théorique à cause des frottements…", "The measured value is lower than the theoretical one because of friction…", "القيمة التجريبية أقل من النظرية بسبب الاحتكاك…"),
        "tp.applications": t("- Routes et rampes d'accès\n- Tapis roulants\n- Systèmes de freinage", "- Roads and ramps\n- Conveyor belts\n- Braking systems", "- الطرق والمنحدرات\n- السيور المتحركة\n- أنظمة الكبح"),
        "tp.references": t("TOPO PHYSIQUE L2 S2\nhttps://fr.khanacademy.org", "Physics handout L2 S2\nhttps://www.khanacademy.org", "مطبوعة الفيزياء\nhttps://www.khanacademy.org"),
        "members.nom": t("ATANGANA", "ATANGANA", "أتانغانا"),
        "members.prenom": t("Brice", "Brice", "بريس"),
        "members.matricule": t("23Q2192", "23Q2192", "23Q2192"),
        "equipment.name": t("Pied à coulisse numérique", "Digital calliper", "قدمة رقمية"),
        "equipment.desc": t("Mesurer le diamètre de la bille", "Measure the ball's diameter", "قياس قطر الكرية"),
        "tables.title": t("Mesures sans frottement", "Measurements without friction", "قياسات دون احتكاك"),
        "tables.data": t("h (m) ; 0,11 ; 0,155 ; 0,2\nt (s) ; 1,17 ; 1,32 ; 1,59", "h (m) ; 0.11 ; 0.155 ; 0.2\nt (s) ; 1.17 ; 1.32 ; 1.59", "h (m) ; 0.11 ; 0.155 ; 0.2\nt (s) ; 1.17 ; 1.32 ; 1.59"),
        "tables.data_cols": t("h (m) ; t (s)\n0,11 ; 1,17\n0,155 ; 1,32", "h (m) ; t (s)\n0.11 ; 1.17\n0.155 ; 1.32", "h (m) ; t (s)\n0.11 ; 1.17\n0.155 ; 1.32"),
        "tables.calc": t("t² (s²) = t^2", "t² (s²) = t^2", "t² (s²) = t^2"),

        // ---------------------------------------------------------------- Rapport de stage
        "stage.company": t("Orange Cameroun – Direction technique, Douala", "Orange Cameroon – Technical department, Douala", "أورانج الكاميرون – المديرية التقنية، دوالا"),
        "stage.tutor": t("M. ESSOMBA Jean, chef de service réseau", "Mr Jean ESSOMBA, network manager", "السيد جان إيسومبا، رئيس مصلحة الشبكة"),
        "stage.thanks": t("Nous remercions M. ESSOMBA pour son encadrement, ainsi que toute l'équipe technique pour son accueil.", "We thank Mr ESSOMBA for his guidance and the whole technical team for their welcome.", "نشكر السيد إيسومبا على تأطيره وكل الفريق التقني على حسن الاستقبال."),
        "stage.intro": t("Dans le cadre de notre formation en Licence de génie informatique, nous avons effectué un stage de trois mois…", "As part of our degree in computer engineering, we completed a three-month internship…", "في إطار تكويننا في الإجازة في هندسة الإعلام الآلي، أجرينا تدريبًا لمدة ثلاثة أشهر…"),
        "stage.presentation": t("Créée en 1999, Orange Cameroun est un opérateur de télécommunications qui emploie plus de 700 personnes…", "Founded in 1999, Orange Cameroon is a telecoms operator with over 700 employees…", "تأسست أورانج الكاميرون سنة 1999، وهي مشغل اتصالات يشغّل أكثر من 700 شخص…"),
        "stage.missions": t("Configuration de routeurs Cisco\nSupervision du réseau avec Zabbix\nRédaction de procédures", "Configuring Cisco routers\nMonitoring the network with Zabbix\nWriting procedures", "إعداد موجهات سيسكو\nمراقبة الشبكة بـ Zabbix\nكتابة الإجراءات"),
        "stage.details": t("Les deux premières semaines ont été consacrées à la découverte des équipements, puis…", "The first two weeks were spent discovering the equipment, then…", "خُصص الأسبوعان الأولان لاكتشاف المعدات، ثم…"),
        "stage.skills": t("Administration réseau\nTravail en équipe\nRigueur et ponctualité", "Network administration\nTeamwork\nRigour and punctuality", "إدارة الشبكات\nالعمل الجماعي\nالدقة والانضباط"),
        "stage.difficulties": t("Le temps d'adaptation aux outils internes et les coupures d'électricité ont parfois ralenti le travail.", "Getting used to internal tools and power cuts sometimes slowed the work.", "أبطأ التكيف مع الأدوات الداخلية وانقطاع الكهرباء العمل أحيانًا."),
        "stage.period": t("Du 1er juillet au 30 septembre 2026", "1 July to 30 September 2026", "من 1 يوليو إلى 30 سبتمبر 2026"),

        // ---------------------------------------------------------------- Rapport d'activités
        "activites.period": t("Janvier – juin 2026", "January – June 2026", "يناير – يونيو 2026"),
        "activites.summary": t("Au cours du semestre, l'association a organisé 6 activités ayant touché 450 étudiants…", "Over the semester, the association ran 6 activities reaching 450 students…", "خلال السداسي، نظمت الجمعية 6 أنشطة استفاد منها 450 طالبًا…"),
        "activites.indicators": t("Indicateur ; Objectif ; Réalisé\nParticipants ; 400 ; 450\nActivités ; 5 ; 6", "Indicator ; Target ; Achieved\nParticipants ; 400 ; 450\nActivities ; 5 ; 6", "المؤشر ; الهدف ; المحقق\nالمشاركون ; 400 ; 450"),
        "activites.challenges": t("Manque de salles disponibles et budget limité.", "Lack of available rooms and a limited budget.", "نقص القاعات المتاحة وميزانية محدودة."),
        "activites.next": t("Organiser une journée carrière\nLancer un club de lecture", "Hold a careers day\nStart a reading club", "تنظيم يوم مهني\nإطلاق نادي قراءة"),
        "activites.activities.name": t("Journée de dépistage du diabète", "Diabetes screening day", "يوم الكشف عن السكري"),
        "activites.activities.when": t("12 mars 2026", "12 March 2026", "12 مارس 2026"),
        "activites.activities.desc": t("Dépistage gratuit organisé avec l'hôpital central sur le campus.", "Free screening organised with the central hospital on campus.", "كشف مجاني بالتعاون مع المستشفى المركزي في الحرم الجامعي."),
        "activites.activities.result": t("230 personnes dépistées, 12 orientées vers un médecin.", "230 people screened, 12 referred to a doctor.", "تم فحص 230 شخصًا وتوجيه 12 إلى الطبيب."),

        // ---------------------------------------------------------------- Exposé écrit / TPE
        "tpe.title": t("EXPOSÉ D'ANATOMIE ET CYTOPATHOLOGIE", "ANATOMY AND CYTOPATHOLOGY REPORT", "عرض في التشريح وعلم الأمراض الخلوي"),
        "tpe.theme": t("L'athérosclérose", "Atherosclerosis", "تصلب الشرايين"),
        "tpe.parts.title": t("Généralités", "Overview", "عموميات"),
        "tpe.parts.content": t("# Définition\nL'athérosclérose est une maladie des artères…\n# Épidémiologie\n- 1re cause de mortalité dans le monde\n- Fréquente après 50 ans", "# Definition\nAtherosclerosis is a disease of the arteries…\n# Epidemiology\n- Leading cause of death worldwide\n- Common after 50", "# تعريف\nتصلب الشرايين مرض يصيب الشرايين…\n# الوبائيات\n- السبب الأول للوفيات عالميًا"),

        // ---------------------------------------------------------------- Compte rendu de réunion
        "reunion.subject": t("Préparation de la journée culturelle", "Planning the cultural day", "التحضير لليوم الثقافي"),
        "reunion.place": t("Salle A, Bâtiment des sciences", "Room A, Science building", "القاعة أ، مبنى العلوم"),
        "reunion.chair": t("Le Président du bureau, M. ONANA", "The board chair, Mr ONANA", "رئيس المكتب، السيد أونانا"),
        "reunion.attendees": t("ONANA Luc (Président)\nNGO Marie (Secrétaire)\nFOUDA Eric (Trésorier)", "Luc ONANA (Chair)\nMarie NGO (Secretary)\nEric FOUDA (Treasurer)", "لوك أونانا (الرئيس)\nماري نغو (الكاتبة)"),
        "reunion.absents": t("ABENA Joëlle (excusée)", "Joëlle ABENA (apologies)", "جويل أبينا (معتذرة)"),
        "reunion.agenda": t("Budget de la journée\nRépartition des tâches\nDivers", "Event budget\nTask allocation\nAOB", "ميزانية اليوم\nتوزيع المهام\nمتفرقات"),
        "reunion.decisions": t("Le budget est fixé à 250 000 FCFA\nLa journée aura lieu le 20 avril", "The budget is set at 250,000 FCFA\nThe event will take place on 20 April", "حُددت الميزانية بـ 250000 فرنك\nسيُقام اليوم في 20 أبريل"),
        "reunion.next": t("Samedi 5 avril 2026 à 10 h", "Saturday 5 April 2026 at 10 am", "السبت 5 أبريل 2026 على الساعة 10"),
        "reunion.secretary": t("NGO Marie, secrétaire", "Marie NGO, secretary", "ماري نغو، الكاتبة"),
        "reunion.points.title": t("Budget de la journée", "Event budget", "ميزانية اليوم"),
        "reunion.points.content": t("Le trésorier a présenté les devis. Après discussion, les membres ont retenu…", "The treasurer presented the quotes. After discussion, members agreed…", "قدّم أمين المال العروض. وبعد النقاش اتفق الأعضاء…"),
        "reunion.actions.task": t("Réserver la salle des fêtes", "Book the hall", "حجز قاعة الحفلات"),
        "reunion.actions.owner": t("FOUDA Eric", "Eric FOUDA", "إريك فودا"),
        "reunion.actions.deadline": t("30 mars 2026", "30 March 2026", "30 مارس 2026"),

        // ---------------------------------------------------------------- CV
        "cv.name": t("ATANGANA Brice", "Brice ATANGANA", "بريس أتانغانا"),
        "cv.job": t("Développeur web et mobile", "Web and mobile developer", "مطوّر ويب وتطبيقات"),
        "cv.phone": t("+237 6 90 00 00 00", "+237 6 90 00 00 00", "+237 6 90 00 00 00"),
        "cv.email": t("brice.atangana@exemple.cm", "brice.atangana@example.com", "brice.atangana@example.com"),
        "cv.address": t("Yaoundé, Cameroun", "Yaoundé, Cameroon", "ياوندي، الكاميرون"),
        "cv.profile": t("Développeur passionné, 3 ans d'expérience en applications Android et sites web. Rigoureux, autonome et orienté résultats.", "Passionate developer with 3 years' experience in Android apps and websites. Rigorous, autonomous and results-driven.", "مطوّر شغوف بخبرة 3 سنوات في تطبيقات أندرويد والمواقع. دقيق ومستقل وموجّه نحو النتائج."),
        "cv.skills": t("Kotlin, Java\nHTML, CSS, JavaScript\nGestion de projet", "Kotlin, Java\nHTML, CSS, JavaScript\nProject management", "Kotlin وJava\nHTML وCSS وJavaScript\nإدارة المشاريع"),
        "cv.languages": t("Français — langue maternelle\nAnglais — courant", "French — native\nEnglish — fluent", "الفرنسية — اللغة الأم\nالإنجليزية — ممتاز"),
        "cv.interests": t("Football\nLecture\nMusique", "Football\nReading\nMusic", "كرة القدم\nالقراءة\nالموسيقى"),
        "cv.references": t("M. ESSOMBA Jean, Orange Cameroun – +237 6 99 00 00 00", "Mr Jean ESSOMBA, Orange Cameroon – +237 6 99 00 00 00", "السيد جان إيسومبا، أورانج الكاميرون"),
        "cv.experience.role": t("Développeur Android (stage)", "Android developer (intern)", "مطوّر أندرويد (متدرب)"),
        "cv.experience.company": t("axOlut, Yaoundé", "axOlut, Yaoundé", "أكسولوت، ياوندي"),
        "cv.experience.period": t("Janv. 2025 – juin 2026", "Jan 2025 – Jun 2026", "يناير 2025 – يونيو 2026"),
        "cv.experience.desc": t("Développement de 3 applications Android\nMise en place d'une base de données hors ligne", "Built 3 Android apps\nSet up an offline database", "تطوير 3 تطبيقات أندرويد\nإنشاء قاعدة بيانات دون اتصال"),
        "cv.education.degree": t("Licence en génie logiciel", "Bachelor's in software engineering", "إجازة في هندسة البرمجيات"),
        "cv.education.school": t("Université de Yaoundé I", "University of Yaoundé I", "جامعة ياوندي 1"),
        "cv.education.period": t("2023 – 2026", "2023 – 2026", "2023 – 2026"),
        "cv.education.details": t("Mention Bien", "Upper second-class honours", "تقدير جيد"),

        // ---------------------------------------------------------------- Lettre de motivation
        "motivation.subject": t("Candidature au poste d'assistant comptable", "Application for the position of accounting assistant", "طلب ترشح لمنصب مساعد محاسب"),
        "motivation.body": t("Titulaire d'un BTS en comptabilité, je souhaite mettre mes compétences au service de votre entreprise…\n\nLors de mon stage chez…, j'ai appris à…", "Holding a diploma in accounting, I would like to bring my skills to your company…\n\nDuring my internship at…, I learned to…", "بصفتي حاصلًا على شهادة في المحاسبة، أرغب في وضع مهاراتي في خدمة مؤسستكم…"),
        "motivation.recipient": t("Madame la Responsable des Ressources Humaines\nSociété Générale Cameroun\nDouala", "The HR Manager\nSociété Générale Cameroon\nDouala", "السيدة مسؤولة الموارد البشرية\nسوسيتي جنرال الكاميرون\nدوالا"),

        // ---------------------------------------------------------------- Exposé PowerPoint
        "expose.title": t("La photosynthèse", "Photosynthesis", "التركيب الضوئي"),
        "expose.subtitle": t("Exposé de SVT – Terminale D", "Biology presentation – Upper sixth", "عرض في علوم الحياة – السنة النهائية"),
        "expose.authors": t("ONANA Carine\nBELLO Amina", "ONANA Carine\nBELLO Amina", "أونانا كارين\nبيلو أمينة"),
        "expose.teacher": t("Mme BIDZANGA, PLEG de SVT", "Mrs BIDZANGA, biology teacher", "السيدة بيدزانغا، أستاذة علوم الحياة"),
        "expose.institution": t("Lycée de Ngousso, Yaoundé", "Ngousso High School, Yaoundé", "ثانوية نغوسو، ياوندي"),
        "expose.slides.title": t("Introduction", "Introduction", "مقدمة"),
        "expose.slides.points": t("Définition de la photosynthèse\nPourquoi elle est vitale\nPlan de l'exposé", "What photosynthesis is\nWhy it matters\nOutline", "تعريف التركيب الضوئي\nلماذا هو حيوي\nخطة العرض"),

        // ---------------------------------------------------------------- Pitch
        "pitch.name": t("FAFIO", "FAFIO", "FAFIO"),
        "pitch.tagline": t("Tes documents bien présentés en quelques minutes, même hors ligne.", "Well-presented documents in minutes, even offline.", "مستنداتك منسقة في دقائق، حتى دون اتصال."),
        "pitch.problem": t("Les élèves perdent des heures à mettre en forme leurs exposés\nPeu ont un ordinateur", "Students waste hours formatting their reports\nFew own a computer", "يضيّع الطلاب ساعات في تنسيق عروضهم\nقلة يملكون حاسوبًا"),
        "pitch.solution": t("Une application mobile qui génère PDF, Word et PowerPoint à partir de formulaires simples", "A mobile app that generates PDF, Word and PowerPoint from simple forms", "تطبيق محمول ينشئ PDF وWord وPowerPoint من استمارات بسيطة"),
        "pitch.market": t("2 millions d'élèves et d'étudiants au Cameroun\nÉcoles et petites entreprises", "2 million pupils and students in Cameroon\nSchools and small businesses", "مليونا تلميذ وطالب في الكاميرون\nالمدارس والمؤسسات الصغيرة"),
        "pitch.model": t("Gratuit avec publicité\nPremium à 1 000 FCFA/mois", "Free with ads\nPremium at 1,000 FCFA/month", "مجاني مع إعلانات\nنسخة مميزة بـ 1000 فرنك شهريًا"),
        "pitch.competition": t("Word et Canva : complexes sur téléphone\nNotre avantage : modèles camerounais, hors ligne", "Word and Canva: hard to use on phones\nOur edge: Cameroonian templates, offline", "Word وCanva صعبان على الهاتف\nميزتنا: قوالب كاميرونية ودون اتصال"),
        "pitch.team": t("Brice ATANGANA – fondateur, développeur\nAmina BELLO – marketing", "Brice ATANGANA – founder, developer\nAmina BELLO – marketing", "بريس أتانغانا – مؤسس ومطوّر\nأمينة بيلو – تسويق"),
        "pitch.needs": t("5 millions FCFA pour le marketing et 2 développeurs", "5 million FCFA for marketing and 2 developers", "5 ملايين فرنك للتسويق ومطوّرين اثنين"),
        "pitch.contact": t("contact@monprojet.cm – +237 6 00 00 00 00", "contact@myproject.com – +237 6 00 00 00 00", "contact@myproject.com"),

        // ---------------------------------------------------------------- Lettres
        "lettre.sender_function": t("Étudiant en Master 1 de droit", "First-year Master's student in law", "طالب ماستر 1 في القانون"),
        "lettre.reference": t("Votre annonce du 2 mars 2026", "Your advert of 2 March 2026", "إعلانكم بتاريخ 2 مارس 2026"),
        "attestation.org": t("Collège Bilingue La Réussite", "La Réussite Bilingual College", "المعهد الثنائي اللغة النجاح"),
        "attestation.org_details": t("BP 1234 Douala – Tél. +237 2 33 00 00 00", "PO Box 1234 Douala – Tel. +237 2 33 00 00 00", "ص.ب 1234 دوالا"),
        "attestation.body": t("Je soussignée, Dr ATANGANA Marie, Directrice, atteste que M. MBARGA Paul a effectué un stage dans notre établissement du 1er juillet au 30 août 2026.", "I, the undersigned Dr Marie ATANGANA, Director, certify that Mr Paul MBARGA completed an internship with us from 1 July to 30 August 2026.", "أنا الموقعة أدناه د. ماري أتانغانا، المديرة، أشهد أن السيد بول مبارغا أجرى تدريبًا في مؤسستنا من 1 يوليو إلى 30 أغسطس 2026."),
        "note.service": t("Direction des affaires académiques", "Academic affairs department", "مديرية الشؤون الأكاديمية"),
        "note.subject": t("Calendrier des examens du second semestre", "Second-semester exam timetable", "رزنامة امتحانات السداسي الثاني"),
        "note.body": t("Il est porté à la connaissance de tout le personnel que les examens du second semestre se tiendront du 10 au 21 juin 2026…", "All staff are informed that second-semester exams will take place from 10 to 21 June 2026…", "يُعلَم كافة الموظفين أن امتحانات السداسي الثاني ستجرى من 10 إلى 21 يونيو 2026…"),

        // ---------------------------------------------------------------- Formulaires
        "fiche.intro": t("Veuillez remplir lisiblement et en majuscules.", "Please fill in clearly, in capital letters.", "يرجى الملء بخط واضح وبأحرف كبيرة."),
        "fiche.title": t("Fiche d'inscription au club informatique", "Computer club registration form", "استمارة التسجيل في نادي الإعلام الآلي"),
        "questionnaire.title": t("Enquête sur l'usage du téléphone en classe", "Survey on phone use in class", "استبيان حول استخدام الهاتف في القسم"),
        "questionnaire.intro": t("Ce questionnaire est anonyme et ne prend que 3 minutes.", "This questionnaire is anonymous and takes only 3 minutes.", "هذا الاستبيان مجهول الهوية ويستغرق 3 دقائق فقط."),
        "questionnaire.questions.q": t("Combien d'heures passez-vous sur votre téléphone par jour ?", "How many hours a day do you spend on your phone?", "كم ساعة تقضي على هاتفك يوميًا؟"),
        "questionnaire.questions.options": t("Moins de 2 h\nDe 2 à 4 h\nPlus de 4 h", "Less than 2 h\n2 to 4 h\nMore than 4 h", "أقل من ساعتين\nمن 2 إلى 4 ساعات\nأكثر من 4 ساعات"),
        "suivi.title": t("Fiche de présence des répétiteurs", "Tutors' attendance sheet", "بطاقة حضور المدرّسين"),
        "suivi.subtitle": t("Mois d'octobre 2026 – Classe de 3e", "October 2026 – Year 10", "شهر أكتوبر 2026 – القسم الثالث"),

        // ---------------------------------------------------------------- Graphiques et tableaux
        "graphique.title": t("Évolution des inscriptions de 2022 à 2026", "Enrolments from 2022 to 2026", "تطور التسجيلات من 2022 إلى 2026"),
        "graphique.x_label": t("Année", "Year", "السنة"),
        "graphique.y_label": t("Nombre d'élèves", "Number of pupils", "عدد التلاميذ"),
        "graphique.comment": t("Les inscriptions ont presque doublé en cinq ans, avec une forte hausse en 2025.", "Enrolments nearly doubled in five years, with a sharp rise in 2025.", "تضاعفت التسجيلات تقريبًا في خمس سنوات مع ارتفاع قوي في 2025."),
        "graphique.points.x": t("2024", "2024", "2024"),
        "graphique.points.y": t("1250", "1250", "1250"),
        "tableau.title": t("Population des grandes villes du Cameroun", "Population of Cameroon's largest cities", "سكان أكبر مدن الكاميرون"),
        "tableau.columns": t("Ville\nPopulation\nRégion", "City\nPopulation\nRegion", "المدينة\nعدد السكان\nالمنطقة"),
        "tableau.note": t("Source : BUCREP, 2025", "Source: BUCREP, 2025", "المصدر: BUCREP، 2025"),

        // ---------------------------------------------------------------- Mémoire
        "memoire.faculty": t("Faculté des Sciences\nDépartement de Physique", "Faculty of Science\nDepartment of Physics", "كلية العلوم\nقسم الفيزياء"),
        "memoire.degree": t("Master en Physique", "Master of Science in Physics", "ماستر في الفيزياء"),
        "memoire.speciality": t("Mécanique et énergétique", "Mechanics and energy", "الميكانيك والطاقة"),
        "memoire.title": t("Modélisation de la chute d'un corps dans un fluide visqueux", "Modelling the fall of a body in a viscous fluid", "نمذجة سقوط جسم في مائع لزج"),
        "memoire.author_info": t("Matricule : 18Q1234\nTitulaire d'une Licence en Physique", "Student no.: 18Q1234\nBSc in Physics", "رقم التسجيل: 18Q1234\nحاصل على ليسانس في الفيزياء"),
        "memoire.director": t("Pr MBALLA Jean, Maître de conférences", "Prof. Jean MBALLA, Associate Professor", "أ.د. جان مبالا، أستاذ محاضر"),
        "memoire.supervisors": t("Dr ATANGANA Paul, Chargé de cours", "Dr Paul ATANGANA, Lecturer", "د. بول أتانغانا، محاضر"),
        "memoire.jury": t("Président : Pr OWONO Marc\nRapporteur : Pr MBALLA Jean\nExaminateur : Dr ESSOMBA Luc", "Chair: Prof. Marc OWONO\nReviewer: Prof. Jean MBALLA\nExaminer: Dr Luc ESSOMBA", "الرئيس: أ.د. مارك أوونو\nالمقرر: أ.د. جان مبالا\nالممتحن: د. لوك إيسومبا"),
        "memoire.epigraph": t("« Le savoir est la seule richesse qu'on ne peut pas voler. »", "\"Knowledge is the only wealth that cannot be stolen.\"", "« العلم هو الثروة الوحيدة التي لا تُسرق. »"),
        "memoire.dedication": t("À mes parents, pour leur soutien sans faille.", "To my parents, for their unfailing support.", "إلى والديّ، على دعمهما الدائم."),
        "memoire.thanks": t("Je remercie le Pr MBALLA pour la direction de ce travail, ainsi que…", "I thank Prof. MBALLA for supervising this work, as well as…", "أشكر الأستاذ مبالا على إشرافه على هذا العمل، وكذلك…"),
        "memoire.abbreviations": t("UY1 : Université de Yaoundé I\nEDO : Équation différentielle ordinaire", "UY1: University of Yaoundé I\nODE: Ordinary differential equation", "UY1 : جامعة ياوندي 1\nEDO : معادلة تفاضلية عادية"),
        "memoire.resume": t("Ce travail porte sur… Les résultats montrent que…", "This work deals with… The results show that…", "يتناول هذا العمل… وتُظهر النتائج أن…"),
        "memoire.keywords": t("chute libre ; viscosité ; modélisation", "free fall; viscosity; modelling", "السقوط الحر؛ اللزوجة؛ النمذجة"),
        "memoire.abstract": t("This work deals with… The results show that…", "This work deals with… The results show that…", "This work deals with… The results show that…"),
        "memoire.keywords_en": t("free fall; viscosity; modelling", "free fall; viscosity; modelling", "free fall; viscosity; modelling"),
        "memoire.intro": t("# Contexte\nLa chute des corps…\n# Problématique\nComment… ?\n# Objectifs\n- …", "# Background\nThe fall of bodies…\n# Research question\nHow… ?\n# Objectives\n- …", "# السياق\nسقوط الأجسام…\n# الإشكالية\nكيف… ؟\n# الأهداف\n- …"),
        "memoire.chapters.title": t("Revue de la littérature", "Literature review", "مراجعة الأدبيات"),
        "memoire.chapters.content": t("# Généralités\nLe poids s'écrit $\\vec{P} = m\\vec{g}$.\n## Le frottement visqueux\n$$\\vec{f} = -k\\vec{v}$$", "# Overview\nThe weight is $\\vec{P} = m\\vec{g}$.\n## Viscous drag\n$$\\vec{f} = -k\\vec{v}$$", "# عموميات\nيُكتب الثقل $\\vec{P} = m\\vec{g}$.\n## الاحتكاك اللزج\n$$\\vec{f} = -k\\vec{v}$$"),
        "memoire.perspectives": t("Étendre le modèle au régime turbulent.", "Extend the model to the turbulent regime.", "توسيع النموذج إلى النظام المضطرب."),
        "memoire.annexes": t("# Annexe 1 : Code de simulation\n…", "# Appendix 1: Simulation code\n…", "# الملحق 1: شيفرة المحاكاة\n…"),

        // ---------------------------------------------------------------- Couverture officielle
        "cv_lab": t("Laboratoire d'énergie et des systèmes électriques", "Energy and electrical systems laboratory", "مخبر الطاقة والأنظمة الكهربائية"),
        "cv_group": t("Lundi 13h – 16h", "Monday 1 pm – 4 pm", "الإثنين 13:00 – 16:00"),
        "cv_info": t("OPTION : Physique fondamentale", "OPTION: Fundamental physics", "التخصص: الفيزياء الأساسية"),
        "cv_supervision": t("Pr ATANGANA Marc\nDr MBELLE Paul", "Prof. Marc ATANGANA\nDr Paul MBELLE", "أ.د. مارك أتانغانا\nد. بول مبيلي"),
        "cv_year": t("2026/2027", "2026/2027", "2026/2027"),

        // ---------------------------------------------------------------- Images et graphiques
        "figures.caption": t("Courbe de titrage pH = f(V)", "Titration curve pH = f(V)", "منحنى المعايرة pH = f(V)"),
        "figures.x_label": t("Volume de soude (mL)", "NaOH volume (mL)", "حجم الصودا (مل)"),
        "figures.y_label": t("pH", "pH", "pH"),
        "figures.data": t("0 ; 1,2\n5 ; 1,8\n10 ; 7,0\n15 ; 11,9", "0 ; 1.2\n5 ; 1.8\n10 ; 7.0\n15 ; 11.9", "0 ; 1.2\n5 ; 1.8\n10 ; 7.0"),
    };

export function example(typeId, groupId, fieldId) {
    if (groupId != null) {
        const a = map[`${typeId}.${groupId}.${fieldId}`] || map[`${groupId}.${fieldId}`];
        if (a) return a;
    }
    return map[`${typeId}.${fieldId}`] || map[fieldId] || null;
}
