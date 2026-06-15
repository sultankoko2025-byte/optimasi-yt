import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini SDK to prevent startup crashes when key is not present initially.
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in your Secrets / .env.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ----------------------------------------------------
// Mock Deep Datasets for Trending YouTube Videos
// ----------------------------------------------------
const CATEGORIES = ["Semua", "Teknologi & Gadget", "Edukasi & Eksperimen", "Kuliner & Mukbang", "Gaming", "Gaya Hidup & Vlog"];

function generateMockTrending() {
  return [
    {
      id: "trend-1",
      rank: 1,
      title: "Ulasan Jujur Smartphone Masa Depan Layar Lipat Tiga - Apakah Layak?",
      channelName: "GadgetTekno ID",
      category: "Teknologi & Gadget",
      views: 1254300,
      likes: 92400,
      publishedTime: "12 jam lalu",
      tags: ["smartphone", "layar lipat", "review gadget", "teknologi masa depan"],
      type: "standard",
      thumbnailColor: "from-blue-600 to-indigo-900",
      estimatedEarning: "Rp 15.400.000 - Rp 34.200.000",
      growthRate: 15.8,
      demographics: { age18_24: 45, age25_34: 40, other: 15 },
      trafficSources: { search: 30, browse: 50, suggested: 15, other: 5 }
    },
    {
      id: "trend-2",
      rank: 2,
      title: "Mencoba Bertahan Hidup 24 Jam di Atas Es Rakit Buatan Sendiri!",
      channelName: "EksperimenGokil",
      category: "Edukasi & Eksperimen",
      views: 980500,
      likes: 81000,
      publishedTime: "18 jam lalu",
      tags: ["survival", "eksperimen", "tantangan 24 jam", "petualangan"],
      type: "standard",
      thumbnailColor: "from-teal-600 to-cyan-900",
      estimatedEarning: "Rp 12.000.000 - Rp 27.500.000",
      growthRate: 12.4,
      demographics: { age18_24: 60, age25_34: 25, other: 15 },
      trafficSources: { search: 10, browse: 60, suggested: 25, other: 5 }
    },
    {
      id: "trend-3",
      rank: 3,
      title: "Spicy Mukbang Samyang 5 Level Terpedas + Toping Mozzarela Meleleh 🌶️🔥",
      channelName: "MakanKenyang",
      category: "Kuliner & Mukbang",
      views: 742100,
      likes: 53200,
      publishedTime: "8 jam lalu",
      tags: ["mukbang", "makanan pedas", "samyang", "mozzarella"],
      type: "short",
      thumbnailColor: "from-red-600 to-orange-900",
      estimatedEarning: "Rp 4.500.000 - Rp 10.200.000",
      growthRate: 24.2,
      demographics: { age18_24: 50, age25_34: 35, other: 15 },
      trafficSources: { search: 5, browse: 20, suggested: 70, other: 5 }
    },
    {
      id: "trend-4",
      rank: 4,
      title: "Speedrun Membangun Kota Megapolitan Terpadat dalam Game City Builder!",
      channelName: "GamerSantuy",
      category: "Gaming",
      views: 520400,
      likes: 38900,
      publishedTime: "1 hari lalu",
      tags: ["simulation game", "speedrun", "gaming indonesia", "city builder"],
      type: "standard",
      thumbnailColor: "from-purple-600 to-fuchsia-900",
      estimatedEarning: "Rp 6.000.000 - Rp 14.500.000",
      growthRate: 8.1,
      demographics: { age18_24: 55, age25_34: 30, other: 15 },
      trafficSources: { search: 20, browse: 40, suggested: 35, other: 5 }
    },
    {
      id: "trend-5",
      rank: 5,
      title: "Kamar Kos 3x3 Minimalis ala Aesthetic Tokyo Room Tour!",
      channelName: "SariVlog",
      category: "Gaya Hidup & Vlog",
      views: 489000,
      likes: 35000,
      publishedTime: "1 hari lalu",
      tags: ["room tour", "kost aesthetic", "minimalis", "gaya hidup"],
      type: "short",
      thumbnailColor: "from-pink-500 to-rose-900",
      estimatedEarning: "Rp 3.100.000 - Rp 7.800.000",
      growthRate: 14.5,
      demographics: { age18_24: 40, age25_34: 45, other: 15 },
      trafficSources: { search: 25, browse: 35, suggested: 35, other: 5 }
    }
  ];
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Endpoint to list trending videos with detailed stats
app.get("/api/trending", (req, res) => {
  try {
    const data = generateMockTrending();
    res.json({ success: true, categories: CATEGORIES, videos: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint for SEO Optimization using Gemini API
app.post("/api/optimize", async (req, res) => {
  const { videoType, topic, targetAudience, keywords, tone } = req.body;

  if (!topic) {
    res.status(400).json({ success: false, error: "Topic/Topik video wajib diisi." });
    return;
  }

  const cleanKeywords = Array.isArray(keywords) ? keywords.join(", ") : "";

  try {
    const ai = getGeminiClient();

    const prompt = `Anda adalah Spesialis SEO YouTube Professional.
Optimalkan video YouTube dengan parameter berikut:
- Tipe Video: ${videoType === "short" ? "YouTube Shorts" : "Video Standard Panjang"}
- Topik / Deskripsi Ide: ${topic}
- Target Penonton: ${targetAudience || "Umum / Publik Indonesia"}
- Kata Kunci Utama: ${cleanKeywords || "Optimasi otomatis berdasarkan topik"}
- Nada Penyampaian: ${tone || "engaging"}

Hasilkan optimasi SEO terstruktur yang ditulis dalam Bahasa Indonesia. Format respons Anda HARUS berupa JSON yang valid dengan kunci-kunci berikut dan pastikan tidak ada markdown di luar block JSON:
{
  "titles": ["Daftar 3-5 opsi judul video yang sangat menarik, menggunakan teknik clickability tinggi, rasa penasaran, atau keterbacaan SEO kuat. Berikan kombinasi ramah pencarian dan viral."],
  "description": "Deskripsi YouTube yang dioptimalkan secara mendalam (di atas 150 kata). Untuk video standard, sertakan saran struktur stempel waktu (timestamps) fiktif seperti 00:00 - Intro, dll. Untuk Shorts, buat deskripsi yang lebih ringkas tapi kaya hashtag populer.",
  "tags": ["10-15 tag YouTube relevan dengan pencarian tinggi sesuai topik"],
  "hooks": ["3 opsi kalimat Hook pembuka video (durasi 3 detik pertama) untuk menahan retensi penonton secara ekstrem."],
  "shortsVibe": {
    "suggestedAudioStyle": "Gaya audio/lagu latar yang cocok untuk mengiringi video ini",
    "optimalDuration": "Durasi optimal (misal: '35-45 detik' atau '12-15 detik berulang')",
    "loopStrategy": "Trik menyusun script akhir agar video looping sempurna tanpa disadari penonton"
  },
  "score": {
    "seoScore": 85, 
    "searchVolume": "Sangat Tinggi atau Tinggi atau Sedang atau Rendah",
    "competition": "Sangat Rendah atau Rendah atau Sedang atau Tinggi"
  },
  "recommendations": [
    "3 butir saran spesifik pelengkap terkait thumbnail, desain visual, atau cara penyampaian kata kunci secara verbal agar diindeks AI transkrip YouTube."
  ]
}

Pastikan respons hanya memuat JSON murni yang siap di-parse.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    const resultObj = JSON.parse(text);

    res.json({ success: true, data: resultObj });
  } catch (error: any) {
    console.error("Gemini API Error in optimize:", error);
    // Graceful response fallback in case of missing API Key or other errors
    res.status(200).json({
      success: false,
      isDemo: true,
      error: error.message,
      message: "Menggunakan fallback generator offline karena API Key Gemini belum diatur atau bermasalah.",
      data: {
        titles: [
          `🔥 Cara Ampuh: ${topic} (Tips Untuk Pemula!)`,
          `Jangan Salah! Ini Rahasia Sukses ${topic} yang Jarang Diketahui`,
          `${topic}: Panduan Lengkap & Strategi Kilat 2026`,
          `Kebongkar! Mengapa Masalah ${topic} Bisa Terjadi & Solusinya`
        ],
        description: `Berikut adalah rincian panduan tentang ${topic}.\n\nBanyak orang kesulitan memahami bagaimana mengoptimalkan aspek ini. Di video ini kami membedah langkah demi langkah agar Anda mendapat peningkatan penonton secara eksponensial.\n\n📌 Timestamps:\n00:00 - Intro & Masalah Utama\n01:30 - Analisis Dasar ${topic}\n03:45 - Solusi Praktis & Implementasi\n06:20 - Contoh Kasus Sukses\n08:50 - Kesimpulan & Sesi Q&A\n\nJangan lupa Like, Comment, dan Subscribe agar tidak ketinggalan konten berfaedah berikutnya!`,
        tags: [topic.toLowerCase().replace(/\s+/g, ""), "seo youtube", "tips konten kreator", "viral indonesia", "trending", "cara viral", ...cleanKeywords.split(",").map(k => k.trim()).filter(Boolean)],
        hooks: [
          `Tunggu! Sebelum Anda melakukan kesalahan fatal pada ${topic}, ketahui hal penting satu ini!`,
          `Pernahkah Anda bertanya-tanya mengapa kreator besar selalu berhasil menguasai ${topic}? Ini jawabannya.`,
          `Dalam 30 detik ke depan, saya akan menunjukkan rahasia ${topic} yang bisa mengubah performa channel Anda!`
        ],
        shortsVibe: {
          suggestedAudioStyle: "Electronic Uplifting Beat atau Cinematic Tension Drop",
          optimalDuration: "28 - 35 detik",
          loopStrategy: "Sambungkan kalimat simpulan akhir dengan kata pertama pada hook awal sehingga memicu repetisi putaran penonton."
        },
        score: {
          seoScore: 92,
          searchVolume: "Tinggi",
          competition: "Rendah"
        },
        recommendations: [
          "Gunakan Thumbnail dengan teks kontras tinggi (maksimal 3 kata).",
          "Ucapkan kata kunci utama dalam 10 detik pertama video agar transkrip otomatis merekam suara Anda.",
          "Letakkan tautan video Shorts Anda yang lain di kolom deskripsi sebagai video terkait."
        ]
      }
    });
  }
});

// Endpoint for Keyword Finder ("Sedikit Pesaing, Jangka Panjang / Low Competition, Long Term")
app.post("/api/low-competition-ideas", async (req, res) => {
  const { nicheKeywords } = req.body;
  const keywordSeed = nicheKeywords || "Umum";

  try {
    const ai = getGeminiClient();

    const prompt = `Anda adalah Analis Riset Kata Kunci YouTube Tingkat Lanjut.
Tugas Anda adalah menemukan 3 ide topik / kata kunci video spesifik yang memiliki kompetisi SANGAT RENDAH (sedikit pesaing) tetapi memiliki nilai cari JANGKA PANJANG (Evergreen, dicari berbulan-bulan bahkan bertahun-tahun di masa depan).
Benih niche kata kunci: ${keywordSeed}

Format respons Anda HARUS berupa JSON array berisi tepat 3 objek yang valid, pastikan tidak ada markdown di luar block JSON:
[
  {
    "id": "idea-1",
    "category": "Kategori platform (misal: Edukasi, Tech, Hobi, Rumah Tangga)",
    "niche": "Sub-niche mikro yang sangat spesifik",
    "coreTopic": "Judul kata kunci evergreen yang sedikit pesaingnya",
    "volumeScore": 75,
    "competitionScore": 25,
    "growthFactor": "Penjelasan mengapa topik ini dicari terus dalam jangka panjang (evergreen value)",
    "suggestedTitles": ["3 opsi variasi judul terbaik untuk memancing klik"],
    "seoOutline": "Garis besar struktur video (Langkah demi langkah cara membawakannya)",
    "suggestedTags": ["tag-1", "tag-2", "tag-3"]
  }
]

Hasilkan dalam Bahasa Indonesia yang informatif dan taktis.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "[]";
    const resultArr = JSON.parse(text);

    res.json({ success: true, data: resultArr });
  } catch (error: any) {
    console.error("Gemini API Error in low-competition-ideas:", error);
    // Fallback evergreen low-competition ideas
    res.status(200).json({
      success: false,
      isDemo: true,
      error: error.message,
      data: [
        {
          id: "fallback-idea-1",
          category: "Produktivitas & Gaya Hidup",
          niche: "Sistem Pengorganisasian Digital Kreator Gaji Kecil",
          coreTopic: "Cara Mengatur Manajemen File Video Creator dengan Google Drive Free Tier Tanpa Berlangganan",
          volumeScore: 78,
          competitionScore: 18,
          growthFactor: "Kreator pemula selalu bertambah dan semua orang ingin menghindari biaya langganan bulanan awan (cloud storage). Pencarian ini ramah jangka panjang.",
          suggestedTitles: [
            "Trik Memaksimalkan Google Drive 15GB Untuk Arsip Editing Video (Tanpa Bayar!)",
            "Cara Saya Mengatur File Mentah YouTube Biar Gak Menuhin Memori Laptop",
            "Sistem Manajemen Asset Kreator Hemat: Panduan Bebas Cloud Berbayar"
          ],
          seoOutline: "1. Tunjukkan masalah memori penyimpanan penuh. 2. Solusi struktur folder 3-tier. 3. Trik kompres zip tanpa merusak visual video. 4. Menghapus cache temporary editor otomatis.",
          suggestedTags: ["manajemenfile", "hematmemori", "googledrivegratis", "editingvideo", "kreatorhemat"]
        },
        {
          id: "fallback-idea-2",
          category: "Teknologi Praktis",
          niche: "Revitalisasi Gadget Lama Untuk Rumah Tangga",
          coreTopic: "Cara Menyulap HP Android Jadul Rusak Baterai Menjadi IP CCTV Pemantau Bayi Non-stop",
          volumeScore: 82,
          competitionScore: 22,
          growthFactor: "Hampir semua rumah memiliki HP android lama yang tidak terpakai, dan biaya CCTV IP Cam asli yang bagus cukup tinggi. Solusi daur ulang selalu dicari selamanya.",
          suggestedTitles: [
            "Jangan Dibuang! HP Jadul Jadi CCTV Keamanan Rumah 24 Jam Full HD",
            "Langkah Mudah Ubah Android Bekas Menjadi Baby Monitor Pintar Gratis",
            "DIY CCTV Rumah Gratisan Pakai Smartphone yang Sudah Rusak Baterai"
          ],
          seoOutline: "1. Demo HP lama memantau ruangan secara real-time. 2. Rekomendasi aplikasi gratis bebas iklan yang aman. 3. Cara bypass charger agar baterai tidak kembung (safety tips). 4. Cara setup mounting di sudut ruangan.",
          suggestedTags: ["cctvdarihp", "smartphonebekas", "diycctv", "keamananrumah", "daurulangandroid"]
        },
        {
          id: "fallback-idea-3",
          category: "Keuangan dan Hobi",
          niche: "Hobi tanaman hias bernilai ekonomi tinggi mikro",
          coreTopic: "Panduan Budidaya Lumut Hias Terarium Indoor untuk Pasar Ekspor Ekologi",
          volumeScore: 71,
          competitionScore: 12,
          growthFactor: "Hobi terarium terus bertumbuh secara internasional tanpa mengenal musim, namun sedikit sekali peternak lumut hias lokal yang membuat tutorial terstruktur cara budidaya steril.",
          suggestedTitles: [
            "Peluang Sampingan: Budidaya Lumut Terarium di Kamar Sendiri Raup Dollar",
            "Cara Menumbuhkan Moss Tanpa Tanah Untuk Kebutuhan Dekorasi Estetis",
            "Panduan Rahasia Sterilisasi Lumut Hutan Agar Laku Dijual Online"
          ],
          seoOutline: "1. Visual terarium mewah bernilai tinggi. 2. Alat sederhana nampan plastik & lampu LED. 3. Rahasia cairan nutrisi lumut racikan sendiri. 4. Metode packing lumut steril agar tahan kirim 7 hari.",
          suggestedTags: ["budidayalumut", "mossishigami", "terariumpemula", "bisnisrumahan", "tanamanhias"]
        }
      ]
    });
  }
});


// ----------------------------------------------------
// VITE CLIENT INTEGRATION
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[YouTube SEO Tracker Server] running on http://localhost:${PORT}`);
  });
}

startServer();
