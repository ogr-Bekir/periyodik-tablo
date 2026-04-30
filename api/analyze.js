export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { formula } = req.body;
  if (!formula || typeof formula !== 'string' || formula.trim().length === 0) {
    return res.status(400).json({ error: 'Geçersiz formül' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY eksik' });
  }

  const prompt = `Sen kapsamlı bir kimya uzmanısın. Kullanıcı şu element kombinasyonunu girdi: ${formula}

Bu kombinasyondan oluşabilecek TÜM olası bileşikleri analiz et.

ÇOK ÖNEMLİ: Yanıtını SADECE geçerli JSON formatında ver, başka hiçbir şey yazma.

{
  "bileskikler": [
    {
      "formul": "H2O",
      "iupac_adi": "su (dihidrojen monoksit)",
      "bag_turu": "polar kovalent",
      "hal": "sıvı",
      "renk": "renksiz",
      "erime_noktasi": "0°C",
      "kaynama_noktasi": "100°C",
      "kullanim": "içme suyu, çözücü, metabolizma",
      "organik_mi": false,
      "fonksiyonel_grup": null,
      "organik_sinif": null,
      "elektroliz": null
    }
  ],
  "izotoplar": [
    {
      "element": "H",
      "izotoplar": [
        {"sembol": "¹H", "kitle": 1, "durum": "kararlı", "kullanim": "en yaygın hidrojen izotopu"},
        {"sembol": "²H (Döteryum)", "kitle": 2, "durum": "kararlı", "kullanim": "nükleer reaktörler"}
      ]
    }
  ],
  "bag_yapisi": "H2O molekülünde oksijen 2 hidrojenle polar kovalent bağ kurar. Açısal geometri (104.5°). Yüksek elektronegatiflik farkı nedeniyle kuvvetli dipol moment oluşur."
}

Sadece JSON döndür, markdown veya açıklama ekleme.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      console.error('Groq error:', err);
      return res.status(502).json({ error: 'Yapay zeka servisine ulaşılamadı' });
    }

    const groqData = await groqRes.json();
    let text = groqData.choices?.[0]?.message?.content || '';

    // strip markdown fences if any
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // fallback: return raw text
      return res.status(200).json({ raw: text });
    }

    // For each bileşik, fetch PubChem CID
    const enriched = await Promise.all(
      (parsed.bileskikler || []).map(async (b) => {
        try {
          const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(b.formul)}/cids/JSON`;
          const cidRes = await fetch(searchUrl);
          if (!cidRes.ok) return b;
          const cidData = await cidRes.json();
          const cid = cidData?.IdentifierList?.CID?.[0];
          if (!cid) return b;
          return {
            ...b,
            pubchem_cid: cid,
            img_2d: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`,
            pubchem_url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
          };
        } catch {
          return b;
        }
      })
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...parsed, bileskikler: enriched });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}
