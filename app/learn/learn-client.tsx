"use client"

import { PageLayout } from "@/components/page-layout"
import { useState, useEffect, useRef } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell, LabelList } from "recharts"
import { AlertCircle, Heart, Activity, Eye, X, ChevronDown, Check, CalendarCheck, Gauge, Droplet } from "lucide-react"
import Image from "next/image"
import { MenuScanCTA } from "@/components/menu-scan-cta"
import BodyMap from "@/components/body-map"

const content = {
  en: {
    page_title: "The Three Highs: Starting With Diabetes",
    page_subtitle: "High Blood Sugar, High Blood Pressure (Hypertension), and High Cholesterol (Hyperlipidemia) are Malaysia's biggest silent health threats. Understanding them is the first step toward a healthier life.",
    stats_title: "Diabetes in Malaysia",
    education: "Education",
    explore: "Exploration",
    debunk: "Debunking",
    body_map_title: "How the Three Highs affect your body",
    edu_title: "Understand Diabetes and Its Partners (The Three Highs)",
    edu_learn_more: "Learn more",
    edu_show_less: "Show less",
    click_card: "👇 Tap a card to learn more",
    edu_sections: [
      {
        icon: AlertCircle,
        borderColor: "#378ADD",
        iconBg: "#E6F1FB",
        iconColor: "#185FA5",
        titleColor: "#0C447C",
        title: "What is diabetes?",
        shortTitle: "Diabetes",
        points: [
          "Sugar = Energy for your body.",
          "Insulin is the \"key\" that lets sugar into your cells.",
          "In diabetes, the key is broken. Sugar gets stuck in your blood.",
        ],
        types: [
          { label: "Type 1", bg: "#E6F1FB", textColor: "#0C447C", desc: "Born with it.\nBody makes no insulin.\nNeeds daily injections.", image: "/images/edu/Type1.png" },
          { label: "Type 2", bg: "#E1F5EE", textColor: "#085041", desc: "Lifestyle linked.\nBody ignores insulin.\nMost common type.", image: "/images/edu/Type2.png" },
        ],
        subSection: {
          bg: "#E6F1FB",
          titleColor: "#0C447C",
          dotColor: "#378ADD",
          title: "Prediabetes",
          points: [
            { text: "Blood sugar higher than normal", highlight: false },
            { text: "Not yet diabetes", highlight: false },
            { text: "It is reversible, healthy habits can bring it back to normal", highlight: true },
          ],
        },
        learnMore: [
          "Diabetes is a long-term condition. It cannot be cured, but it can be managed well. Many people with diabetes live full, healthy lives.",
          "Type 2 makes up over 90% of cases in Malaysia and develops slowly over years, often without obvious signs.",
          "Doctors diagnose diabetes using an HbA1c blood test, which shows your average blood sugar over 3 months. A fasting blood sugar test is also commonly used.",
          "When sugar stays in your blood, it weakens your blood vessel walls. This makes it much easier for High Blood Pressure to cause damage or High Cholesterol to clog your \"pipes.\" Managing your sugar is the first step in protecting your heart."
        ],
      },
      {
        icon: Gauge,
        borderColor: "#993556",
        iconBg: "#FBEAF0",
        iconColor: "#993556",
        titleColor: "#72243E",
        title: "What is hypertension?",
        shortTitle: "Hypertension",
        points: [
          "Blood = Water flowing through your body.",
          "Vessels = Pipes that carry the water.",
          "Hypertension = High Pressure in the pipes. It's like turning a tap on too full; it wears out the pipes.",
        ],
        types: [
          { label: "Primary", bg: "#FBEAF0", textColor: "#72243E", desc: "Lifestyle & Age linked.\nDevelops slowly over many years.\nMost common type in seniors.", image: "/images/edu/hypertension-primary.png" },
          { label: "Secondary", bg: "#E1F5EE", textColor: "#085041", desc: "Medical Condition linked.\nCaused by an underlying issue.\nOften appears suddenly.", image: "/images/edu/hypertension-secondary.png" },
        ],
        warning: {
          bg: "#FBEAF0",
          iconColor: "#993556",
          textColor: "#72243E",
          text: "The \"Silent Killer\": Most people feel no symptoms until a stroke or heart attack happens. Managing your salt intake and staying active can help bring pressure back to normal levels."
        },
        learnMore: [
          "Reduce Salt: High salt holds extra water in your body, increasing the \"pressure\" in your pipes.",
          "The \"Silent\" Nature: You cannot feel high blood pressure. The only way to know is to check it regularly with a monitor.",
          "Small Steps: Losing even a small amount of weight or walking 15 minutes a day can significantly lower your numbers."
        ],
      },
      {
        icon: Droplet,
        borderColor: "#6D28D9",
        iconBg: "#F5F3FF",
        iconColor: "#6D28D9",
        titleColor: "#4C1D95",
        title: "What is high cholesterol (hyperlipidemia)?",
        shortTitle: "Hyperlipidemia",
        points: [
          "Cholesterol = \"Wax\" or \"Grease\" in your blood.",
          "The Problem: Too much grease makes the blood \"sticky\".",
          "The Danger: It creates narrow tunnels (plaque) making it harder for blood to reach your heart and brain.",
        ],
        types: [
          { label: "LDL (Bad)", bg: "#FEF3C7", textColor: "#92400E", desc: "The Blocker.\nBuilds up as plaque in your pipes.\nIncreases risk of heart attack.", image: "/images/edu/cholesterol-LDL.png"},
          { label: "HDL (Good)", bg: "#F5F3FF", textColor: "#4C1D95", desc: "The Cleaner.\nActs like a vacuum for extra grease.\nTakes grease to liver for removal.", image: "/images/edu/cholesterol-HDL.png" },
        ],
        warning: {
          bg: "#F5F3FF",
          iconColor: "#6D28D9",
          textColor: "#4C1D95",
          text: "Invisible Blockage: You cannot feel your arteries narrowing; it is only found through a blood test. A diet low in saturated fats helps \"sweep\" the bad grease away."
        },
        learnMore: [
          "Fats Matter: Swap \"Saturated Fats\" (like coconut milk or fatty meats) for \"Healthy Fats\" (like nuts or olive oil) to stop plaque buildup.",
          "Fiber is a Broom: Foods like oats and vegetables act like a broom, sweeping the \"bad\" grease (LDL) out of your blood.",
          "Active Cleanup: Regular exercise increases your \"Good\" cholesterol (HDL), which helps carry the \"Bad\" grease away to be destroyed."
        ],
      },
      {
        icon: Eye,
        borderColor: "#BA7517",
        iconBg: "#FAEEDA",
        iconColor: "#854F0B",
        titleColor: "#633806",
        title: "Symptoms to watch for",
        shortTitle: "Symptoms",
        imageTiles: [
          { label: "Very thirsty", image: "/images/edu/symptom-thirsty.png", desc: "Feeling very thirsty even after drinking plenty of water. Your body is trying to flush out extra sugar." },
          { label: "Urinate often", image: "/images/edu/symptom-urinate.png", desc: "Needing to use the toilet much more often than usual, especially during the middle of the night." },
          { label: "Tired & weak", image: "/images/edu/symptom-tired.png", desc: "Feeling very weak or sleepy even after a good night's rest because your body isn't using energy correctly" },
          { label: "Blurry vision", image: "/images/edu/symptom-vision.png", desc: "Things may look fuzzy or out of focus. High sugar levels can cause the lenses in your eyes to swell." },
          { label: "Slow healing", image: "/images/edu/symptom-healing.png", desc: "Cuts, scratches, or bruises that take a long time to go away or seem to get infected easily." },
          { label: "Numbness", image: "/images/edu/symptom-numbness.png", desc: "A 'pins and needles' feeling or loss of sensation in your hands and feet. This happens because high sugar can damage the nerves that help you feel touch." },
        ],
        tileBg: "#FAEEDA",
        tileLabelColor: "#633806",
        warning: {
          bg: "#FAEEDA",
          iconColor: "#854F0B",
          textColor: "#633806",
          text: "Diabetes can show symptoms like thirst, but its partners: High Blood Pressure and Cholesterol are often silent. You may feel perfectly fine while they are damaging your body. Routine checks are the only way to know for sure.",
        },
        seeDoctor: {
          bg: "#E6F1FB",
          titleColor: "#0C447C",
          dotColor: "#378ADD",
          textColor: "#185FA5",
          title: "See a doctor if you:",
          points: [
            "Have 2+ symptoms above",
            "Have a family member with diabetes",
            "Haven't had a blood sugar check in over a year",
          ],
        },
        learnMore: [
          "Foot numbness and tingling are early signs of nerve damage (neuropathy): a complication of long-term high blood sugar that, if ignored, can lead to serious foot problems.",
          "Eye, kidney, and heart damage also develop silently over years. This is why regular screening matters more than waiting for symptoms.",
        ],
      },
      {
        icon: Activity,
        borderColor: "#1D9E75",
        iconBg: "#E1F5EE",
        iconColor: "#0F6E56",
        titleColor: "#085041",
        title: "Risk factors",
        shortTitle: "Risk factors",
        intro: "The same unhealthy habits that cause Diabetes often cause High Blood Pressure and High Cholesterol too. If you have one, you are at a higher risk for the others.",
        points: [
          "Unhealthy diet high in sugar, salt, and saturated fat",
          "Lack of exercise",
          "Being overweight, especially belly fat",
          "Family history of diabetes",
          "Age 40 and above",
        ],
        controllableTiles: {
          canControlLabel: "Can control",
          canControl: [
            { label: "Diet", image: "/images/edu/risk-diet.png" },
            { label: "Exercise", image: "/images/edu/risk-exercise.png" },
            { label: "Weight", image: "/images/edu/risk-weight.png" },
          ],
          cannotControlLabel: "Cannot control",
          cannotControl: [
            { label: "Age", image: "/images/edu/risk-age.png" },
            { label: "Family history", image: "/images/edu/risk-family.png" },
          ],
        },
        learnMore: [
          "Having one or two risk factors does not mean you will definitely get any of the Three Highs, but the more you have, the higher your overall risk.",
          "Belly fat is a particularly strong risk factor. Fat around the organs directly affects how insulin works and increases blood pressure and cholesterol levels.",
          "A diet high in salt raises blood pressure, while one high in saturated and trans fats raises bad (LDL) cholesterol. Sugar and refined carbs raise blood sugar. Often, the same meal is the culprit for all three.",
          "Even if these conditions run in your family, lifestyle changes can delay or prevent them. You are not powerless against your genes.",
        ],
      },
      {
        icon: Heart,
        borderColor: "#7F77DD",
        iconBg: "#EEEDFE",
        iconColor: "#534AB7",
        titleColor: "#3C3489",
        title: "Prevention & healthy habits",
        shortTitle: "Prevention",
        imageTiles: [
          { label: "Drink water", image: "/images/edu/prevention-water.png", desc: "Choosing water over sugary drinks can help control blood sugar and reduce calorie intake." },
          { label: "Less rice", image: "/images/edu/prevention-rice.png", desc: "Eating less refined carbohydrates like white rice or swapping them for whole grains and brown rice can help manage blood sugar levels." },
          { label: "Walk daily", image: "/images/edu/prevention-walk.png", desc: "Regular physical activity helps your body use insulin more effectively. Walk 30 minutes, 5 days a week." },
          { label: "Smaller plate", image: "/images/edu/prevention-plate.png", desc: "Using a smaller plate can help you eat less without feeling deprived." },
          { label: "Yearly check", image: "/images/edu/prevention-check.png", desc: "Regular health screenings especially blood sugar tests can help detect diabetes early." },
          { label: "Sleep well", image: "/images/edu/prevention-sleep.png", desc: "Getting enough sleep is important for overall health and blood sugar control." },
        ],
        tileBg: "#EEEDFE",
        tileLabelColor: "#3C3489",
        note: { bg: "#EEEDFE", textColor: "#3C3489", text: "Small changes done consistently matter more than big changes done occasionally." },
        learnMore: [
          "Brisk walking is one of the most effective activities for blood sugar control, no gym needed. Even 10-minute walks after meals help.",
          "Reducing portion size matters as much as food choice. Using a smaller plate is a simple, practical way to eat less without feeling deprived.",
          "Stress raises blood sugar too. Adequate sleep (7–8 hours), social connection, and relaxation all play a real role in diabetes prevention.",
        ],
      },
      {
        icon: CalendarCheck,
        borderColor: "#D4537E",
        iconBg: "#FBEAF0",
        iconColor: "#993556",
        titleColor: "#72243E",
        title: "Living with diabetes",
        shortTitle: "Living with diabetes",
        intro: "Already diagnosed? Here is what to stay on top of:",
        imageTiles: [
          { label: "Take medication daily", image: "/images/edu/living-medication.png", desc: "If prescribed, taking your diabetes medication every day is crucial for managing your condition. Do not skip doses." },
          { label: "Monitor blood sugar", image: "/images/edu/living-monitor.png", desc: "Regularly checking your blood sugar levels helps you understand how food, exercise, and medication affect your glucose." },
          { label: "Clinic follow-up", image: "/images/edu/living-followup.png", desc: "Attending your scheduled appointments with your healthcare team ensures you receive the best care for your diabetes." },
          { label: "Annual checks", image: "/images/edu/living-checks.png", desc: "Regular comprehensive health exams such as eye, foot, and kidney screenings help monitor for complications and ensure your diabetes management plan is effective." },
        ],
        tileBg: "#FBEAF0",
        tileLabelColor: "#72243E",
        note: { bg: "#FBEAF0", textColor: "#72243E", text: "Managing diabetes is about protecting your whole body. By monitoring your sugar today, you are also reducing the strain on your heart and kidneys from High Blood Pressure and Cholesterol. You aren't just fighting one disease, you're building a healthier future." },
        learnMore: [
          "Your HbA1c target is usually below 7%, ask your doctor what your personal target is. This single number gives the clearest picture of overall blood sugar control.",
          "If you use insulin or certain medications, always carry a snack in case your blood sugar drops too low (hypoglycaemia). Signs include shaking, sweating, and confusion.",
          "Emotional wellbeing matters. Diabetes distress, feeling frustrated or burnt out, is very common and very treatable. Speak to your doctor or a counsellor.",
        ],
      },
    ],
    myth_title: "Myth VS. Fact",
    click_myth: "👇 Tap each myth to see the truth",
    myth_show_less: "Show less",
    myth_show_more: "Show more",
    myths: [
      { myth: "I only need to worry about sugar if I have Diabetes.", fact: "Diabetes rarely travels alone. High blood sugar often damages blood vessels, leading to High Blood Pressure and High Cholesterol. This is why SIHAT tracks all three \"Highs\" together." },
      { myth: "I must completely stop eating white rice/carbs to be healthy.", fact: "Portion and balance matter more than total restriction. Pairing your rice with fiber (vegetables) and protein slows down sugar absorption." },
      { myth: "I have High Cholesterol because I eat too much fat; it has nothing to do with my Diabetes.", fact: "High insulin actually triggers the liver to produce more \"bad\" cholesterol (LDL). When your blood sugar is out of control, your cholesterol often follows. Managing your sugar via SIHAT helps improve your heart health." },
      { myth: "I am thin, so I cannot have the \"Three Highs\".", fact: "You can be \"Thin on the outside, Fat on the inside\" (TOFI). In Malaysia, many people with a healthy weight still have high internal visceral fat, leading to Diabetes and High Cholesterol." },
      { myth: "I can eat as much fruit as I want because it's natural and healthy.", fact: "Tropical fruits like durian, mango, and rambutan are very high in fructose. For someone with Diabetes, too much fruit can spike sugar AND raise triglycerides (fats in the blood)." },
      { myth: "Once I start medication, I don't need to watch my diet anymore.", fact: "Medication works with your lifestyle, not instead of it. Maintaining a healthy diet via SIHAT recommendations can often lead to lower dosages and fewer side effects over time." },
      { myth: "Eating bitter melon (peria) or drinking herbal tea can cure the \"Three Highs\" without medication.", fact: "While some traditional foods have health benefits, they are supplements, not cures. Relying solely on \"natural\" bitter foods while ignoring your data trends is dangerous." },
      { myth: "I only need to cut salt for my blood pressure and sugar for my diabetes.", fact: "High insulin makes your kidneys hold onto more salt. This means eating too much sugar can actually drive your blood pressure up." },
    ],
  },
  ms: {
    page_title: "Tiga Penyakit Tinggi: Bermula dengan Diabetes",
    page_subtitle: "Gula Darah Tinggi, Tekanan Darah Tinggi (Hipertensi), dan Kolesterol Tinggi (Hiperlipidemia) adalah ancaman kesihatan senyap terbesar di Malaysia. Memahami mereka adalah langkah pertama menuju kehidupan yang lebih sihat.",
    stats_title: "Diabetes di Malaysia",
    education: "Pendidikan",
    explore: "Penerokaan",
    debunk: "Membongkar Mitos",
    body_map_title: "Bagaimana Tiga Tinggi mempengaruhi badan anda",
    edu_title: "Fahami Diabetes",
    edu_learn_more: "Klik untuk maklumat lanjut",
    edu_show_less: "Sembunyikan",
    click_card: "👇 Klik pada kad untuk maklumat lanjut",
    edu_sections: [
      {
        icon: AlertCircle,
        borderColor: "#378ADD",
        iconBg: "#E6F1FB",
        iconColor: "#185FA5",
        titleColor: "#0C447C",
        title: "Apa itu diabetes?",
        shortTitle: "Diabetes",
        points: [
          "Badan anda memerlukan gula (glukosa) untuk tenaga",
          "Insulin adalah \"kunci\" yang membenarkan gula masuk ke dalam sel anda",
          "Dalam diabetes, kunci hilang atau rosak — gula berkumpul dalam darah",
        ],
        types: [
          { label: "Jenis 1", bg: "#E6F1FB", textColor: "#0C447C", desc: "Badan tidak menghasilkan insulin. Perlu suntikan harian. Biasanya bermula muda.", image: "/images/edu/Type1.png" },
          { label: "Jenis 2", bg: "#E1F5EE", textColor: "#085041", desc: "Badan mengabaikan insulin. Lebih biasa. Berkait rapat dengan gaya hidup.", image: "/images/edu/Type2.png" },
        ],
        subSection: {
          bg: "#E6F1FB",
          titleColor: "#0C447C",
          dotColor: "#378ADD",
          title: "Pradiabetes",
          points: [
            { text: "Gula darah lebih tinggi daripada biasa", highlight: false },
            { text: "Tetapi belum diabetes", highlight: false },
            { text: "Ia boleh dipulihkan， tabiat sihat boleh mengembalikannya ke normal", highlight: true },
          ],
        },
        learnMore: [
          "Diabetes adalah keadaan jangka panjang — ia tidak boleh disembuhkan, tetapi boleh diuruskan dengan baik. Ramai penghidap diabetes menjalani kehidupan yang penuh dan sihat.",
          "Jenis 2 merangkumi lebih 90% kes di Malaysia dan berkembang perlahan selama bertahun-tahun, sering tanpa tanda yang jelas.",
          "Doktor mendiagnosis diabetes menggunakan ujian darah HbA1c, yang menunjukkan purata gula darah anda selama 3 bulan.",
          "Apabila gula tetap dalam darah, ia melemahkan dinding pembuluh darah anda. Ini memudahkan Tekanan Darah Tinggi menyebabkan kerosakan atau Kolesterol Tinggi menyumbat \"pipa\" anda. Menguruskan gula anda adalah langkah pertama dalam melindungi jantung anda.",
        ],
      },
      {
        icon: Gauge,
        borderColor: "#993556",
        iconBg: "#FBEAF0",
        iconColor: "#993556",
        titleColor: "#72243E",
        title: "Apa itu hipertensi?",
        shortTitle: "Hipertensi",
        points: [
          "Darah = Air yang mengalir di dalam badan anda.",
          "Salur darah = Paip yang membawa air tersebut.",
          "Hipertensi = Tekanan Tinggi dalam paip. Ia seperti membuka paip air terlalu kuat; ia melemahkan paip.",
        ],
        types: [
          { label: "Primer", bg: "#FBEAF0", textColor: "#72243E", desc: "Kaitan gaya hidup & umur.\nBerkembang perlahan.\nPaling biasa dalam kalangan warga emas.", image: "/images/edu/hypertension-primary.png" },
          { label: "Sekunder", bg: "#E1F5EE", textColor: "#085041", desc: "Kaitan masalah perubatan.\nBerpunca dari penyakit lain.\nSering muncul tiba-tiba.", image: "/images/edu/hypertension-secondary.png" },
        ],
        warning: {
          bg: "#FBEAF0",
          iconColor: "#993556",
          textColor: "#72243E",
          text: "\"Pembunuh Senyap\": Kebanyakan orang tidak merasa sebarang gejala sehinggalah strok atau serangan jantung berlaku. Menguruskan pengambilan garam dapat membantu memulihkan tekanan."
        },
        learnMore: [
          "Kurangkan Garam: Garam berlebihan menyimpan lebih banyak air dalam badan, meningkatkan \"tekanan\" dalam paip anda.",
          "Sifat \"Senyap\": Anda tidak dapat merasakan tekanan darah tinggi. Satu-satunya cara adalah dengan memeriksa secara berkala.",
          "Langkah Kecil: Menurunkan sedikit berat badan atau berjalan 15 minit sehari boleh menurunkan bacaan anda dengan ketara."
        ],
      },
      {
        icon: Droplet,
        borderColor: "#6D28D9",
        iconBg: "#F5F3FF",
        iconColor: "#6D28D9",
        titleColor: "#4C1D95",
        title: "Apa itu kolesterol tinggi (hiperlipidemia)?",
        shortTitle: "Hiperlipidemia",
        points: [
          "Kolesterol = \"Lilin\" atau \"Lemak\" di dalam darah anda.",
          "Masalah: Terlalu banyak lemak menjadikan darah \"melekit\".",
          "Bahaya: Ia menyempitkan laluan darah (plak) dan menyukarkan darah sampai ke jantung.",
        ],
        types: [
          { label: "LDL (Jahat)", bg: "#FAEEDA", textColor: "#633806", desc: "Penyumbat.\nBerkumpul sebagai plak dalam paip.\nMeningkatkan risiko serangan jantung.", image: "/images/edu/cholesterol-LDL.png" },
          { label: "HDL (Baik)", bg: "#F5F3FF", textColor: "#4C1D95", desc: "Pencuci.\nBertindak sebagai vakum lemak.\nMembawa lemak ke hati untuk dibuang.", image: "/images/edu/cholesterol-HDL.png" },
        ],
        warning: {
          bg: "#F5F3FF",
          iconColor: "#6D28D9",
          textColor: "#4C1D95",
          text: "Sumbatan Terselindung: Anda tidak boleh merasai saluran darah menyempit; ia hanya dikesan melalui ujian darah."
        },
        learnMore: [
          "Jenis Lemak: Tukar \"Lemak Tepu\" (seperti santan) kepada \"Lemak Sihat\" (seperti minyak zaitun) untuk menghentikan pembentukan plak.",
          "Serat sebagai Penyapu: Makanan seperti oat dan sayuran bertindak menyapu lemak \"jahat\" (LDL) keluar dari darah.",
          "Pembersihan Aktif: Senaman meningkatkan kolesterol \"Baik\" (HDL) yang membantu membuang lemak \"Jahat\"."
        ],
      },
      {
        icon: Eye,
        borderColor: "#BA7517",
        iconBg: "#FAEEDA",
        iconColor: "#854F0B",
        titleColor: "#633806",
        title: "Gejala yang perlu dipantau",
        shortTitle: "Gejala",
        imageTiles: [
          { label: "Sangat dahaga", image: "/images/edu/symptom-thirsty.png", desc: "Merasa sangat dahaga walaupun sudah minum banyak air. Tubuh anda berusaha untuk membuang gula ekstra." },
          { label: "Kerap kencing", image: "/images/edu/symptom-urinate.png", desc: "Kerap perlu kencing, terutama pada malam hari. Gula darah tinggi menyebabkan tubuh anda membuang lebih banyak air." },
          { label: "Penat & lemah", image: "/images/edu/symptom-tired.png", desc: "Merasa sangat penat dan lemah walaupun tidak melakukan aktiviti fizikal yang berat." },
          { label: "Penglihatan kabur", image: "/images/edu/symptom-vision.png", desc: "Penglihatan menjadi kabur atau tidak tajam. Gula darah tinggi boleh mempengaruhi fungsi mata." },
          { label: "Luka lambat sembuh", image: "/images/edu/symptom-healing.png", desc: "Luka atau cedera yang biasanya cepat sembuh menjadi lambat pulih." },
          { label: "Kebas & kesemutan", image: "/images/edu/symptom-numbness.png", desc: "Merasa kebas atau kesemutan di tangan atau kaki. Ini adalah tanda awal kerosakan saraf." },
        ],
        tileBg: "#FAEEDA",
        tileLabelColor: "#633806",
        warning: {
          bg: "#FAEEDA",
          iconColor: "#854F0B",
          textColor: "#633806",
          text: "Diabetes dapat menunjukkan gejala seperti rasa dahaga, tetapi pasangannya: Tekanan Darah Tinggi dan Kolesterol Tinggi seringkali senyap. Anda mungkin merasa baik-baik saja sementara mereka merusak tubuh Anda. Pemeriksaan rutin adalah satu-satunya cara untuk mengetahui dengan pasti.",
        },
        seeDoctor: {
          bg: "#E6F1FB",
          titleColor: "#0C447C",
          dotColor: "#378ADD",
          textColor: "#185FA5",
          title: "Berjumpa doktor jika anda:",
          points: [
            "Mempunyai 2 atau lebih gejala di atas",
            "Mempunyai ahli keluarga yang menghidap diabetes",
            "Belum memeriksa gula darah lebih dari setahun",
          ],
        },
        learnMore: [
          "Kebas dan kesemutan kaki adalah tanda awal kerosakan saraf (neuropati) — komplikasi gula darah tinggi jangka panjang yang boleh membawa masalah kaki yang serius.",
          "Kerosakan mata, buah pinggang, dan jantung juga berlaku secara senyap selama bertahun-tahun. Ini sebabnya saringan berkala lebih penting daripada menunggu gejala.",
        ],
      },
      {
        icon: Activity,
        borderColor: "#1D9E75",
        iconBg: "#E1F5EE",
        iconColor: "#0F6E56",
        titleColor: "#085041",
        title: "Faktor risiko",
        shortTitle: "Faktor risiko",
        intro: "Tabiat tidak sihat yang menyebabkan Diabetes selalunya turut menyebabkan Tekanan Darah Tinggi dan Kolesterol Tinggi. Jika anda menghidap satu, risiko anda untuk mendapat yang lain adalah lebih tinggi.",
        points: [
          "Makanan tidak sihat tinggi gula, garam, dan lemak tepu",
          "Kurang aktiviti fizikal",
          "Berat badan berlebihan, terutama di bahagian perut",
          "Sejarah keluarga diabetes",
          "Umur 40 tahun ke atas",
        ],
        controllableTiles: {
          canControlLabel: "Boleh dikawal",
          canControl: [
            { label: "Pemakanan", image: "/images/edu/risk-diet.png" },
            { label: "Senaman", image: "/images/edu/risk-exercise.png" },
            { label: "Berat badan", image: "/images/edu/risk-weight.png" },
          ],
          cannotControlLabel: "Tidak boleh dikawal",
          cannotControl: [
            { label: "Umur", image: "/images/edu/risk-age.png" },
            { label: "Sejarah keluarga", image: "/images/edu/risk-family.png" },
          ],
        },
        learnMore: [
          "Mempunyai satu atau dua faktor risiko tidak bermakna anda pasti akan menghidap Tiga Tinggi — tetapi lebih banyak faktor yang anda ada, lebih tinggi risiko keseluruhan anda.",
          "Lemak perut adalah faktor risiko yang sangat kuat kerana lemak di sekeliling organ mempengaruhi cara insulin berfungsi dan meningkatkan tekanan darah serta paras kolesterol.",
          "Diet tinggi garam meningkatkan tekanan darah, manakala lemak tepu dan trans meningkatkan kolesterol jahat (LDL). Gula dan karbohidrat olahan meningkatkan gula darah. Selalunya, makanan yang sama menjadi punca ketiga-tiganya.",
          "Walaupun keadaan ini ada dalam keluarga anda, perubahan gaya hidup boleh melambatkan atau mencegahnya. Anda tidak perlu pasrah dengan gen anda.",
        ],
      },
      {
        icon: Heart,
        borderColor: "#7F77DD",
        iconBg: "#EEEDFE",
        iconColor: "#534AB7",
        titleColor: "#3C3489",
        title: "Pencegahan & tabiat sihat",
        shortTitle: "Pencegahan",
        imageTiles: [
          { label: "Minum air kosong", image: "/images/edu/prevention-water.png", desc: "Memilih air kosong daripada minuman bergula dapat membantu mengawal gula darah dan mengurangkan pengambilan kalori." },
          { label: "Kurang nasi", image: "/images/edu/prevention-rice.png", desc: "Mengurangkan pengambilan nasi boleh membantu mengawal gula darah." },
          { label: "Berjalan kaki", image: "/images/edu/prevention-walk.png", desc: "Aktiviti fizikal seperti berjalan kaki boleh meningkatkan sensitiviti insulin dan mengawal gula darah." },
          { label: "Pinggan lebih kecil", image: "/images/edu/prevention-plate.png", desc: "Menggunakan pinggan yang lebih kecil boleh membantu mengurangkan pengambilan kalori." },
          { label: "Semak tahunan", image: "/images/edu/prevention-check.png", desc: "Saringan tahunan boleh membantu mengesan diabetes atau prediabetes dengan awal." },
          { label: "Tidur cukup", image: "/images/edu/prevention-sleep.png", desc: "Tidur yang cukup penting untuk kesejahteraan keseluruhan dan kawalan gula darah." },
        ],
        tileBg: "#EEEDFE",
        tileLabelColor: "#3C3489",
        note: { bg: "#EEEDFE", textColor: "#3C3489", text: "Perubahan kecil yang dilakukan secara konsisten lebih berkesan daripada perubahan besar yang dilakukan sekali-sekala." },
        learnMore: [
          "Berjalan kaki dengan pantas adalah salah satu aktiviti paling berkesan untuk kawalan gula darah, tidak perlu pergi ke gimnasium. Malah berjalan 10 minit selepas makan pun membantu.",
          "Mengurangkan saiz hidangan sama pentingnya dengan pilihan makanan. Menggunakan pinggan yang lebih kecil adalah cara mudah untuk makan lebih sedikit.",
          "Tekanan juga meningkatkan gula darah. Tidur yang cukup (7–8 jam), hubungan sosial, dan relaksasi memainkan peranan nyata dalam pencegahan diabetes.",
        ],
      },
      {
        icon: CalendarCheck,
        borderColor: "#D4537E",
        iconBg: "#FBEAF0",
        iconColor: "#993556",
        titleColor: "#72243E",
        title: "Menjalani hidup dengan diabetes",
        shortTitle: "Hidup dengan diabetes",
        intro: "Sudah didiagnosis? Berikut adalah perkara yang perlu diberi perhatian:",
        imageTiles: [
          { label: "Ambil ubat setiap hari", image: "/images/edu/living-medication.png", desc: "Jika telah dipreskripsikan, mengambil ubat diabetes anda setiap hari sangat penting untuk menguruskan kondisi anda. Jangan melewatkan dosis." },
          { label: "Pantau gula darah", image: "/images/edu/living-monitor.png", desc: "Memantau gula darah secara berkala membantu anda memahami bagaimana makanan dan aktiviti mempengaruhi tahap gula darah anda." },
          { label: "Susulan klinik", image: "/images/edu/living-followup.png", desc: "Menjaga janji temu dengan doktor anda adalah penting untuk memastikan diabetes anda dikawal dengan baik." },
          { label: "Pemeriksaan tahunan", image: "/images/edu/living-checks.png", desc: "Pemeriksaan tahunan boleh membantu mengesan sebarang komplikasi yang mungkin timbul akibat diabetes." },
        ],
        tileBg: "#FBEAF0",
        tileLabelColor: "#72243E",
        note: { bg: "#FBEAF0", textColor: "#72243E", text: "Menguruskan diabetes adalah tentang melindungi seluruh badan anda. Dengan memantau gula anda hari ini, anda juga mengurangkan tekanan pada jantung dan buah pinggang anda daripada Tekanan Darah Tinggi dan Kolesterol. Anda bukan sahaja melawan satu penyakit, anda juga membina masa depan yang lebih sihat." },
        learnMore: [
          "Sasaran HbA1c anda biasanya di bawah 7%, tanya doktor anda apakah sasaran peribadi anda. Nombor tunggal ini memberikan gambaran paling jelas tentang kawalan gula darah keseluruhan.",
          "Jika anda menggunakan insulin atau ubat-ubatan tertentu, sentiasa bawa snek sekiranya gula darah turun terlalu rendah (hipoglisemia). Tanda-tandanya termasuk menggigil, berpeluh, dan keliru.",
          "Kesejahteraan emosi penting. Tekanan diabetes, rasa kecewa atau keletihan, sangat biasa dan boleh dirawat. Berbicara dengan doktor atau kaunselor anda.",
        ],
      },
    ],
    myth_title: "Mitos VS. Fakta",
    click_myth: "👇 Klik setiap mitos untuk melihat kebenarannya",
    myth_show_less: "Tunjukkan kurang",
    myth_show_more: "Tunjukkan lebih banyak",
    myths: [
      { 
        myth: "Saya hanya perlu risau tentang gula jika saya menghidap Kencing Manis.", 
        fact: "Kencing manis jarang datang sendirian. Gula darah yang tinggi sering merosakkan salur darah, membawa kepada Darah Tinggi dan Kolesterol Tinggi. Inilah sebabnya SIHAT memantau ketiga-tiga \"3 Serangkai\" bersama-sama." 
      },
      { 
        myth: "Saya mesti berhenti makan nasi putih/karbohidrat sepenuhnya untuk sihat.", 
        fact: "Saiz hidangan dan keseimbangan lebih penting daripada sekatan sepenuhnya. Menggandakan nasi anda dengan serat (sayur-sayuran) dan protein melambatkan penyerapan gula." 
      },
      { 
        myth: "Kolesterol saya tinggi kerana saya makan terlalu banyak lemak; ia tiada kaitan dengan Kencing Manis saya.", 
        fact: "Tahap insulin yang tinggi sebenarnya merangsang hati untuk menghasilkan lebih banyak kolesterol \"jahat\" (LDL). Apabila gula darah tidak terkawal, kolesterol anda biasanya akan turut naik. Menguruskan gula anda melalui SIHAT membantu meningkatkan kesihatan jantung anda." 
      },
      { 
        myth: "Badan saya kurus, jadi saya tidak mungkin terkena penyakit \"3 Serangkai\".", 
        fact: "Anda boleh jadi \"Kurus di luar, Lemak di dalam\". Di Malaysia, ramai orang yang mempunyai berat badan sihat sebenarnya mempunyai lemak viseral dalaman yang tinggi, yang membawa kepada Kencing Manis dan Kolesterol Tinggi." 
      },
      { 
        myth: "Saya boleh makan buah sebanyak mana yang saya mahu kerana ia semula jadi dan sihat.", 
        fact: "Buah-buahan tropika seperti durian, mangga, dan rambutan mempunyai kandungan fruktosa yang sangat tinggi. Bagi penghidap Kencing Manis, terlalu banyak buah boleh melonjakkan gula DAN meningkatkan trigliserida (lemak dalam darah)." 
      },
      { 
        myth: "Sebaik sahaja saya mula mengambil ubat, saya tidak perlu lagi menjaga pemakanan saya.", 
        fact: "Ubat berfungsi bersama gaya hidup anda, bukan sebagai pengganti. Mengekalkan diet sihat melalui cadangan SIHAT boleh membantu mengurangkan dos ubat dan kesan sampingan dari masa ke masa." 
      },
      { 
        myth: "Makan peria atau minum teh herba boleh menyembuhkan \"3 Serangkai\" tanpa ubat hospital.", 
        fact: "Walaupun sesetengah makanan tradisional mempunyai khasiat kesihatan, ia adalah suplemen, bukan ubat penyembuh. Bergantung sepenuhnya kepada makanan pahit \"semula jadi\" tanpa mempedulikan trend data kesihatan anda adalah berbahaya." 
      },
      { 
        myth: "Saya hanya perlu kurangkan garam untuk darah tinggi dan kurangkan gula untuk kencing manis.", 
        fact: "Insulin yang tinggi menyebabkan buah pinggang menyimpan lebih banyak garam. Ini bermakna pengambilan gula yang berlebihan sebenarnya boleh menyebabkan tekanan darah anda meningkat." 
      },
    ],
  },
  zh: {
    page_title: "三高：从糖尿病开始",
    page_subtitle: "高血糖、 高血压（高血压）和高胆固醇（高脂血症）是马来西亚最大的健康隐形杀手。了解它们是迈向更健康生活的第一步。",
    stats_title: "马来西亚的糖尿病",
    edu_title: "了解糖尿病",
    education: "教育",
    explore: "探索",
    debunk: "揭穿谬误",
    body_map_title: "三高如何影响您的身体",
    edu_learn_more: "了解更多",
    edu_show_less: "收起",
    click_card: "👇 点击卡片了解更多",
    edu_sections: [
      {
        icon: AlertCircle,
        borderColor: "#378ADD",
        iconBg: "#E6F1FB",
        iconColor: "#185FA5",
        titleColor: "#0C447C",
        title: "什么是糖尿病？",
        shortTitle: "糖尿病",
        points: [
          "您的身体需要糖（葡萄糖）来提供能量",
          "胰岛素是让糖进入细胞的“钥匙”",
          "糖尿病时，钥匙丢失或损坏；糖在血液中积聚",
        ],
        types: [
          { label: "1型", bg: "#E6F1FB", textColor: "#0C447C", desc: "身体不产生胰岛素。需要每日注射。通常年轻时发病。", image: "/images/edu/Type1.png" },
          { label: "2型", bg: "#E1F5EE", textColor: "#085041", desc: "身体忽视胰岛素。更常见。与生活方式密切相关。", image: "/images/edu/Type2.png" },
        ],
        subSection: {
          bg: "#E6F1FB",
          titleColor: "#0C447C",
          dotColor: "#378ADD",
          title: "糖尿病前期",
          points: [
            { text: "血糖高于正常水平", highlight: false },
            { text: "尚未达到糖尿病标准", highlight: false },
            { text: "可以逆转，健康习惯可以让血糖恢复正常", highlight: true },
          ],
        },
        learnMore: [
          "糖尿病是一种长期病症；无法治愈，但可以得到良好控制。许多糖尿病患者过着充实健康的生活。",
          "2型糖尿病占马来西亚病例的90%以上，通常在数年内缓慢发展，往往没有明显症状。",
          "医生使用HbA1c血液检测来诊断糖尿病，该检测显示您过去3个月的平均血糖水平。",
          "当糖长时间停留在血液中时，它会损害您的血管壁。这使得高血压更容易造成损害，或高胆固醇更容易堵塞您的“管道”。控制好血糖是保护心脏的第一步。",
        ],
      },
      {
        icon: Gauge,
        borderColor: "#993556",
        iconBg: "#FBEAF0",
        iconColor: "#993556",
        titleColor: "#72243E",
        title: "什么是高血压？",
        shortTitle: "高血压",
        points: [
          "血液 = 在体内流动的水。",
          "血管 = 输送水的管道。",
          "高血压 = 管道内的高压。就像水龙头开得太大，会磨损管道。",
        ],
        types: [
          { label: "原发性", bg: "#FBEAF0", textColor: "#72243E", desc: "与生活方式和年龄相关。\n发展缓慢。\n老年人中最常见。", image: "/images/edu/hypertension-primary.png" },
          { label: "继发性", bg: "#E1F5EE", textColor: "#085041", desc: "由其他医疗问题引起。\n通常突然出现。", image: "/images/edu/hypertension-secondary.png" },
        ],
        warning: {
          bg: "#FBEAF0",
          iconColor: "#993556",
          textColor: "#72243E",
          text: "“沉默的杀手”：大多数人没有任何症状，直到发生中风或心脏病发作。控制盐分摄入有助于恢复正常血压。"
        },
        learnMore: [
          "减少盐分：高盐会使体内积聚多余的水分，增加管道内的“压力”。",
          "沉默的杀手：您感觉不到高血压。唯一的方法是定期使用血压计测量。",
          "小步改善：即使减轻少量体重或每天步行15分钟，也能显著降低血压读数。"
        ],
      },
      {
        icon: Droplet,
        borderColor: "#6D28D9",
        iconBg: "#F5F3FF",
        iconColor: "#6D28D9",
        titleColor: "#4C1D95",
        title: "什么是高胆固醇？",
        shortTitle: "高胆固醇",
        points: [
          "胆固醇 = 血液中的“蜡”或“油脂”。",
          "问题：过多的油脂会使血液变得“粘稠”。",
          "危险：它会在血管内形成狭窄的通道（斑块），使血液难以流向心脏和大脑。",
        ],
        types: [
          { label: "LDL (坏)", bg: "#FAEEDA", textColor: "#633806", desc: "阻塞者。\n在管道中积聚成斑块。\n增加心脏病发作的风险。", image: "/images/edu/cholesterol-LDL.png" },
          { label: "HDL (好)", bg: "#F5F3FF", textColor: "#4C1D95", desc: "清洁工。\n像吸尘器一样吸走多余油脂。\n将油脂带到肝脏清除。", image: "/images/edu/cholesterol-HDL.png" },
        ],
        warning: {
          bg: "#F5F3FF",
          iconColor: "#6D28D9",
          textColor: "#4C1D95",
          text: "隐形阻塞：您无法感觉到动脉变窄；只能通过血液测试发现。"
        },
        learnMore: [
          "脂肪的选择：将“饱和脂肪”（如椰奶或肥肉）换成“健康脂肪”（如坚果或橄榄油），以阻止斑块形成。",
          "纤维如扫帚：燕麦和蔬菜等食物就像扫帚一样，将“坏”油脂 (LDL) 从血液中扫除。",
          "积极清理：定期锻炼会增加您的“好”胆固醇 (HDL)，从而帮助带走“坏”油脂并将其清除。"
        ],
      },
      {
        icon: Eye,
        borderColor: "#BA7517",
        iconBg: "#FAEEDA",
        iconColor: "#854F0B",
        titleColor: "#633806",
        title: "需要注意的症状",
        shortTitle: "症状",
        imageTiles: [
          { label: "非常口渴", image: "/images/edu/symptom-thirsty.png", desc: "即使喝了很多水也感觉非常口渴。您的身体正在试图排出多余的糖分。" },
          { label: "频繁排尿", image: "/images/edu/symptom-urinate.png", desc: "需要更频繁地排尿，尤其是夜间。" },
          { label: "疲倦虚弱", image: "/images/edu/symptom-tired.png", desc: "感到异常疲倦或虚弱，这可能是由于血糖水平不稳定造成的。" },
          { label: "视力模糊", image: "/images/edu/symptom-vision.png", desc: "视力变得模糊，这可能是由于高血糖影响了眼睛的晶状体。" },
          { label: "伤口难愈", image: "/images/edu/symptom-healing.png", desc: "伤口愈合缓慢，这可能是由于高血糖影响了免疫系统。" },
          { label: "麻木刺痛", image: "/images/edu/symptom-numbness.png", desc: "手脚感到麻木或刺痛，这可能是由于高血糖损害了神经。" },
        ],
        tileBg: "#FAEEDA",
        tileLabelColor: "#633806",
        warning: {
          bg: "#FAEEDA",
          iconColor: "#854F0B",
          textColor: "#633806",
          text: "糖尿病可能会有口渴等症状，但它的伴侣：高血压和高胆固醇往往是无声的。您可能感觉良好，而它们却在损害您的身体。定期检查是唯一确定的方法。",
        },
        seeDoctor: {
          bg: "#E6F1FB",
          titleColor: "#0C447C",
          dotColor: "#378ADD",
          textColor: "#185FA5",
          title: "如有以下情况请就医：",
          points: [
            "有2个或以上上述症状",
            "家族成员患有糖尿病",
            "超过一年未检查血糖",
          ],
        },
        learnMore: [
          "脚部麻木和刺痛是神经损伤（神经病变）的早期迹象。这是长期高血糖的并发症，若忽视可能导致严重的足部问题。",
          "眼睛、肾脏和心脏损伤也会在多年内无声发生。这就是为什么定期筛查比等待症状出现更重要。",
        ],
      },
      {
        icon: Activity,
        borderColor: "#1D9E75",
        iconBg: "#E1F5EE",
        iconColor: "#0F6E56",
        titleColor: "#085041",
        title: "风险因素",
        shortTitle: "风险因素",
        intro: "导致糖尿病的不健康习惯，往往也会导致高血压和高胆固醇。如果您患有其中一种，患其他疾病的风险也会更高。",
        points: [
          "高糖、高盐、高饱和脂肪的不健康饮食",
          "日常活动不足",
          "超重，尤其是腹部肥胖",
          "家族成员（父母或兄弟姐妹）患有糖尿病",
          "40岁及以上",
        ],
        controllableTiles: {
          canControlLabel: "可以控制",
          canControl: [
            { label: "饮食", image: "/images/edu/risk-diet.png" },
            { label: "运动", image: "/images/edu/risk-exercise.png" },
            { label: "体重", image: "/images/edu/risk-weight.png" },
          ],
          cannotControlLabel: "无法控制",
          cannotControl: [
            { label: "年龄", image: "/images/edu/risk-age.png" },
            { label: "家族史", image: "/images/edu/risk-family.png" },
          ],
        },
        learnMore: [
          "拥有一两个风险因素并不意味着您一定会患上三高，但风险因素越多，整体风险越高。",
          "腹部脂肪是一个特别强的风险因素，因为器官周围的脂肪直接影响胰岛素的工作方式，并会升高血压和胆固醇水平。",
          "高盐饮食会升高血压，而饱和脂肪和反式脂肪会升高坏胆固醇（LDL）。糖和精制碳水化合物会升高血糖。通常，同一顿饭就是三者的共同诱因。",
          "即使这些疾病在您的家族中有遗传，生活方式的改变也可以延迟或预防它们。",
        ],
      },
      {
        icon: Heart,
        borderColor: "#7F77DD",
        iconBg: "#EEEDFE",
        iconColor: "#534AB7",
        titleColor: "#3C3489",
        title: "预防与健康习惯",
        shortTitle: "预防",
        imageTiles: [
          { label: "喝白开水", image: "/images/edu/prevention-water.png", desc: "选择白开水而不是含糖饮料可以帮助控制血糖并减少热量摄入。" },
          { label: "少吃白米", image: "/images/edu/prevention-rice.png", desc: "减少精制碳水化合物的摄入，如白米，有助于控制血糖。" },
          { label: "每日步行", image: "/images/edu/prevention-walk.png", desc: "每天进行适量的步行运动有助于提高胰岛素敏感性并控制血糖。" },
          { label: "小碗进食", image: "/images/edu/prevention-plate.png", desc: "使用较小的碗碟可以帮助控制食物份量，从而更好地管理血糖。" },
          { label: "每年检查", image: "/images/edu/prevention-check.png", desc: "定期进行健康检查可以及早发现并管理糖尿病风险。" },
          { label: "充足睡眠", image: "/images/edu/prevention-sleep.png", desc: "保证充足的睡眠有助于维持正常的血糖水平和整体健康。" },
        ],
        tileBg: "#EEEDFE",
        tileLabelColor: "#3C3489",
        note: { bg: "#EEEDFE", textColor: "#3C3489", text: "持续做出小改变比偶尔做出大改变更有效。" },
        learnMore: [
          "快步行走是控制血糖最有效的活动之一，不需要去健身房。甚至饭后散步10分钟也有帮助。",
          "减少食物份量与食物选择同样重要。使用较小的碗碟是减少进食量的简单方法。",
          "压力也会升高血糖。充足睡眠（7-8小时）、社交联系和放松在预防糖尿病中都起着真实的作用。",
        ],
      },
      {
        icon: CalendarCheck,
        borderColor: "#D4537E",
        iconBg: "#FBEAF0",
        iconColor: "#993556",
        titleColor: "#72243E",
        title: "与糖尿病共存",
        shortTitle: "与糖尿病共存",
        intro: "已确诊？以下是需要注意的事项：",
        imageTiles: [
          { label: "每日按时服药", image: "/images/edu/living-medication.png", desc: "如果医生开了药，每天按时服用对管理病情至关重要。不要漏服。" },
          { label: "监测血糖", image: "/images/edu/living-monitor.png", desc: "定期监测血糖水平有助于了解病情并调整治疗方案。" },
          { label: "定期复诊", image: "/images/edu/living-followup.png", desc: "按照医生的建议定期复诊，以评估病情进展和治疗效果。" },
          { label: "年度检查", image: "/images/edu/living-checks.png", desc: "每年进行一次全面的健康检查，以及时发现并处理可能的并发症。" },
        ],
        tileBg: "#FBEAF0",
        tileLabelColor: "#72243E",
        note: { bg: "#FBEAF0", textColor: "#72243E", text: "管理糖尿病就是保护您的整个身体。通过监测今天的血糖，您还能减轻高血压和高胆固醇对心脏和肾脏的负担。您不仅是在对抗一种疾病，更是在构建一个更健康的未来。" },
        learnMore: [
          "您的HbA1c目标通常在7%以下，询问医生您的个人目标。这个数字可以最清楚地反映整体血糖控制情况。",
          "如果您使用胰岛素或某些药物，请随身携带零食，以防血糖过低（低血糖）。症状包括颤抖、出汗和意识混乱。",
          "情绪健康很重要。糖尿病困扰，感到沮丧或精疲力竭是非常普遍且可以治疗。请与医生或辅导员交流。",
        ],
      },
    ],
    myth_title: "谬误 VS. 事实",
    click_myth: "👇 点击每个谬误查看真相",
    myth_show_less: "收起",
    myth_show_more: "展开",
    myths: [
      { 
        myth: "我只有患有糖尿病时才需要担心血糖问题。", 
        fact: "糖尿病很少孤立存在。高血糖往往会损伤血管，导致高血压和高胆固醇。这就是为什么 SIHAT 会同时监测这“三大高”的原因。" 
      },
      { 
        myth: "为了健康，我必须完全停止吃白饭或碳水化合物。", 
        fact: "份量控制和饮食均衡比完全禁食更重要。将米饭与纤维（蔬菜）和蛋白质搭配食用可以减缓糖分的吸收。" 
      },
      { 
        myth: "我的胆固醇高是因为我吃太多脂肪；这与我的糖尿病无关。", 
        fact: "高胰岛素水平实际上会刺激肝脏产生更多“坏”胆固醇 (LDL)。当您的血糖失控时，胆固醇通常也会随之升高。通过 SIHAT 管理血糖有助于改善您的心脏健康。" 
      },
      { 
        myth: "我很瘦，所以我不会患上“三高”。", 
        fact: "您可能是“外瘦内胖”。在马来西亚，许多体重正常的人其实体内内脏脂肪很高，这会导致糖尿病和高胆固醇。" 
      },
      { 
        myth: "我可以随心所欲地吃水果，因为它们是天然健康的。", 
        fact: "榴莲、芒果和红毛丹等热带水果的果糖含量非常高。对于糖尿病患者，摄入过多水果会导致血糖飙升并增加甘油三酯（血液中的脂肪）。" 
      },
      { 
        myth: "一旦我开始服药，我就不再需要注意饮食了。", 
        fact: "药物是配合您的生活方式发挥作用的，而不是替代它。通过 SIHAT 的建议保持健康饮食，通常可以随着时间的推移减少药量和副作用。" 
      },
      { 
        myth: "吃苦瓜或喝凉茶可以治愈“三高”，不需要吃药。", 
        fact: "虽然某些传统食物对健康有益，但它们是辅助品，而非治疗药物。仅仅依赖“天然”苦味食物而忽视数据趋势是危险的。" 
      },
      { 
        myth: "我只需要为了血压减盐，为了血糖减糖。", 
        fact: "高胰岛素会促使肾脏吸收更多的盐分。这意味着摄入过多的糖分实际上会导致您的血压升高。" 
      },
    ],
  },
}

// Shared placeholder shown when an image hasn't been added yet
function ImgOrPlaceholder({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl flex items-center justify-center ${className ?? ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
      />
    </div>
  )
}

function EduCard({ section, learnMoreLabel, showLessLabel, clickCardLabel, open, setOpen, activeTileIndices, setActiveTileIndices }: { 
  section: typeof content.en.edu_sections[0]; learnMoreLabel: string; showLessLabel: string; clickCardLabel: string;
  open: boolean; setOpen: (v: boolean | ((prev: boolean) => boolean)) => void; activeTileIndices: Set<number>; setActiveTileIndices: (v: Set<number>) => void; }) {

  return (
    <div
      className="rounded-2xl bg-background flex flex-col overflow-hidden shadow-sm"
      style={{ border: `0.5px solid color-mix(in srgb, ${section.borderColor} 35%, transparent)` }}
    >
      {/* Accent bar */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: section.borderColor }} />

      {/* Card body */}
      <div className="p-6 sm:p-7 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: section.iconBg }}
          >
            <section.icon className="w-8 h-8" style={{ color: section.iconColor }} />
          </div>
          <h3 className="text-2xl font-bold leading-snug" style={{ color: section.titleColor }}>
            {section.title}
          </h3>
        </div>

        <div className="border-t border-border/100" />

        {/* Intro sentence (shown before bullet points if present) */}
        {"intro" in section && section.intro && (
          <p className="text-lg leading-relaxed text-foreground">{section.intro as string}</p>
        )}

        {/* Main bullet points */}
        {"points" in section && section.points && (
          <ul className="space-y-2.5">
            {(section.points as string[]).map((point, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-[7px]"
                  style={{ backgroundColor: section.borderColor }}
                />
                <span className="text-lg leading-relaxed text-foreground">{point}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Type 1 / Type 2 tiles — with image */}
        {"types" in section && section.types && (
          <div className="grid grid-cols-2 gap-3">
            {section.types.map((t, i) => (
              <div key={i} className="rounded-xl p-4 flex flex-col items-center text-center gap-2" style={{ backgroundColor: t.bg }}>
                <ImgOrPlaceholder src={t.image} alt={t.label} className="w-full h-24" />
                <p className="text-base font-bold" style={{ color: t.textColor }}>{t.label}</p>
                <p className="text-base leading-snug text-foreground whitespace-pre-line">{t.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Prediabetes subsection */}
        {"subSection" in section && section.subSection && (
          <div className="rounded-xl p-4" style={{ backgroundColor: section.subSection.bg }}>
            <p className="text-base font-bold mb-2.5" style={{ color: section.subSection.titleColor }}>
              {section.subSection.title}
            </p>
            <ul className="space-y-2">
              {section.subSection.points.map((pt, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mt-[7px]"
                    style={{ backgroundColor: section.subSection!.dotColor }}
                  />
                  <span
                    className="text-base leading-relaxed"
                    style={{
                      color: pt.highlight ? section.subSection!.titleColor : "var(--foreground)",
                      fontWeight: pt.highlight ? 800 : 400,
                    }}
                  >
                    {pt.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Controllable tiles (risk factors) */}
        {"controllableTiles" in section && section.controllableTiles && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-base font-medium mb-2" style={{ color: "#085041" }}>
                {section.controllableTiles.canControlLabel}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {section.controllableTiles.canControl.map((tile, i) => (
                  <div key={i} className="rounded-xl p-2 flex flex-col items-center gap-2 text-center" style={{ backgroundColor: "#E1F5EE" }}>
                    <ImgOrPlaceholder src={tile.image} alt={tile.label} className="w-full h-20" />
                    <p className="text-base font-medium leading-tight" style={{ color: "#085041" }}>{tile.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-base font-medium mb-2" style={{ color: "#633806" }}>
                {section.controllableTiles.cannotControlLabel}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {section.controllableTiles.cannotControl.map((tile, i) => (
                  <div key={i} className="rounded-xl p-2 flex flex-col items-center gap-2 text-center" style={{ backgroundColor: "#FAEEDA" }}>
                    <ImgOrPlaceholder src={tile.image} alt={tile.label} className="w-full h-20" />
                    <p className="text-base font-medium leading-tight" style={{ color: "#633806" }}>{tile.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* Image tiles — label only (symptoms, prevention, living) */}
        {"imageTiles" in section && section.imageTiles && (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-medium text-muted-foreground flex items-center gap-2"> {clickCardLabel}</p>
            <div className="grid grid-cols-2 gap-3 items-start">
              {section.imageTiles.map((tile: any, i: number) => {
                const isActive = activeTileIndices.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const next = new Set(activeTileIndices);
                      if (isActive) next.delete(i); else next.add(i);
                      setActiveTileIndices(next);
                    }}
                    className="rounded-xl p-3 flex flex-col items-center gap-2 text-center transition-all duration-200 
                    border-2 w-full cursor-pointer hover:shadow-md active:scale-95"
                    style={{ 
                      backgroundColor: section.tileBg,
                      // Add a border when active to show it's selected
                      border: isActive ? `2px solid ${section.titleColor}` : '2px solid transparent'
                    }}
                  >
                    <ImgOrPlaceholder src={tile.image} alt={tile.label} className="w-full h-20 transition-transform hover:scale-105" />
                    <p className="text-base font-medium leading-tight" style={{ color: section.tileLabelColor }}>
                      {tile.label}
                    </p>
                    
                    {/* Expanded content when tapped */}
                    {isActive && (
                      <div className="mt-2 text-base text-left w-full animate-in fade-in slide-in-from-top-2">
                        <div className="border-t border-black/10 pt-2 mb-1" />
                        <p style={{ color: section.tileLabelColor }}>
                          {tile.desc || "Tap again to close. (Add 'desc' to this item in your content object!)"}
                        </p>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Warning box (symptoms) */}
        {"warning" in section && section.warning && typeof section.warning === "object" && (
          <div className="rounded-xl p-3 flex items-start gap-3" style={{ backgroundColor: section.warning.bg }}>
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: section.warning.iconColor }} />
            <span className="text-base font-medium leading-snug" style={{ color: section.warning.textColor }}>
              {section.warning.text}
            </span>
          </div>
        )}

        {/* See a doctor box (symptoms) */}
        {"seeDoctor" in section && section.seeDoctor && (
          <div className="rounded-xl p-4" style={{ backgroundColor: section.seeDoctor.bg }}>
            <p className="text-base font-bold mb-2" style={{ color: section.seeDoctor.titleColor }}>
              {section.seeDoctor.title}
            </p>
            <ul className="space-y-1.5">
              {section.seeDoctor.points.map((pt, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[8px]" style={{ backgroundColor: section.seeDoctor!.dotColor }} />
                  <span className="text-base leading-relaxed" >{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Note / quote */}
        {"note" in section && section.note && (
          <div className="rounded-xl p-3" style={{ backgroundColor: section.note.bg }}>
            <p className="text-base leading-relaxed italic" style={{ color: section.note.textColor }}>
              {section.note.text}
            </p>
          </div>
        )}

        {/* Learn more expandable */}
        {"learnMore" in section && section.learnMore && (
          <>
            <button
              onClick={() => setOpen(o => !o)}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-medium border border-border/100 text-foreground hover:bg-muted transition-colors"
            >
              <ChevronDown
                className="w-4 h-4 transition-transform duration-200"
                style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
              />
              {open ? showLessLabel : learnMoreLabel}
            </button>
            {open && (
              <div className="flex flex-col gap-2 pt-1 border-t border-border/20">
                {(section.learnMore as string[]).map((para, idx) => (
                  <p key={idx} className="text-lg leading-relaxed text-foreground">{para}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>     
    </div>
  )
}

function MythCard({ item }: { item: { myth: string; fact: string } }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all duration-200 shadow-sm"
      style={{
        borderColor: open ? "#1D9E75" : "var(--border)",
      }}
    >
      {/* Accordion trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted"
      >
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200"
          style={{
            backgroundColor: "#FCEBEB",
          }}
        >
          <X className="w-4 h-4" style={{ color: "#A32D2D" }} />
          
        </div>

        {/* Myth text */}
        <span
          className="flex-1 font-medium text-base md:text-lg leading-snug"
          style={{ color: open ? "var(--muted-foreground)" : "var(--foreground)",
            textDecoration: open ? "line-through" : "none" }}
        >
          {item.myth}
        </span>

        {/* Chevron */}
        <ChevronDown
          className="w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Fact reveal */}
      {open && (
        <div
          className="px-5 pb-5 pt-1 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ backgroundColor: "#E1F5EE" }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "#1D9E75" }}>
            <Check className="w-4 h-4 text-white" />
          </div>
          <p className="text-base md:text-lg leading-relaxed" style={{ color: "#085041" }}>{item.fact}</p>
        </div>
      )}
    </div>
  )
}

export default function LearnClient() {
  const [activeEduIndex, setActiveEduIndex] = useState(0)
  const [learnMoreOpen, setLearnMoreOpen] = useState(false)
  const [activeTileIndices, setActiveTileIndices] = useState<Set<number>>(new Set())
  const [showAll, setShowAll] = useState(false)

  function switchCard(idx: number) {
    setActiveEduIndex(idx)
    setLearnMoreOpen(false)
    setActiveTileIndices(new Set())
  }
  
  return (
    <PageLayout>
      {(lang) => {
        const t = content[lang]
        const visibleMyths = showAll ? t.myths : t.myths.slice(0, 5)
        return (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-5xl font-extrabold mb-4 text-balance">{t.page_title}</h1>
              <p className="text-lg md:text-xl text-muted-foreground">{t.page_subtitle}</p>
            </div>

            {/* Education Section */}
            <div className="scroll-mt-10" id="education-section">
              <div>
                {/* Section header — left aligned, same edge as tabs and card */}
                <div className="mb-6">
                  <p className="text-lg font-medium uppercase tracking-widest text-muted-foreground mb-1.5">{t.education}</p>
                  <h2 className="text-3xl md:text-3xl font-bold">{t.edu_title}</h2>
                </div>

                {/* Education Navigation Tabs */}
                <div className="flex flex-wrap gap-3 mb-8">
                  {t.edu_sections.map((section, idx) => {
                    const isActive = activeEduIndex === idx
                    return (
                      <button
                        key={idx}
                        onClick={() => switchCard(idx)}
                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-150 font-medium text-base md:text-lg"
                        style={{
                          borderColor: isActive ? section.borderColor : "var(--border)",
                          backgroundColor: isActive ? section.iconBg : "var(--card)",
                          color: isActive ? section.titleColor : "var(--foreground)",
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: isActive ? "white" : section.iconBg }}
                        >
                          <section.icon
                            className="w-4 h-4"
                            style={{ color: section.iconColor }}
                          />
                        </div>
                        {section.shortTitle ?? section.title}
                      </button>
                    )
                  })}
                </div>

                {/* Display only the active card */}
                <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <EduCard
                    section={t.edu_sections[activeEduIndex]}
                    learnMoreLabel={t.edu_learn_more}
                    showLessLabel={t.edu_show_less}
                    clickCardLabel={t.click_card}
                    open={learnMoreOpen}
                    setOpen={setLearnMoreOpen}
                    activeTileIndices={activeTileIndices}
                    setActiveTileIndices={setActiveTileIndices}
                  />
                </div>
              </div>
            </div>

            {/* Body Map Section */}
            <div className="mt-14">
              <div className="mb-6">
                <p className="text-lg font-medium uppercase tracking-widest text-muted-foreground mb-1.5">{t.explore}</p>
                <h2 className="text-3xl font-bold">{t.body_map_title}</h2>
              </div>
              <BodyMap lang={lang} />
            </div>

            {/* Myth vs Fact Section */}
            <div className="mt-14">
              <div className="mb-6">
                <p className="text-lg font-medium uppercase tracking-widest text-muted-foreground mb-1.5">{t.debunk}</p>
                <h2 className="text-3xl font-bold">{t.myth_title}</h2>
                <p className="text-lg font-medium text-muted-foreground flex items-center gap-2"> {t.click_myth}</p>
              </div>

              <div className="flex flex-col gap-3">
                {visibleMyths.map((item, idx) => (
                  <MythCard key={idx} item={item} />
                ))}
              </div>

              {t.myths.length > 5 && (
                <button
                  onClick={() => setShowAll(o => !o)}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-base font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ChevronDown
                    className="w-4 h-4 transition-transform duration-200"
                    style={{ transform: showAll ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                  {showAll ? t.myth_show_less : t.myth_show_more}
                </button>
              )}
            </div>

            {/* ── Menu scan CTA ── */}
            <div className="mt-14">
              <MenuScanCTA lang={lang} variant="learn"/>
            </div>
          </div>
        )
      }}
    </PageLayout>
  )
}