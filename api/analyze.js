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

  const prompt = `Sen kapsamlı bir kimya uzmanısın. Kullanıcı şu elementleri girdi: ${formula}

ÇOK ÖNEMLİ KURAL: Sadece VERİLEN elementlerin TAMAMINI veya bir kısmını kullanan bileşikleri ver. Fazladan element EKLEYEMEZSİN. Örneğin H ve O verilmişse H2SO4 veremezsin çünkü S yok.

E�er verilen elementlerle iyon oluşuyorsa (örn. Na+ , Cl-, OH-), sadece o iyonu ver, başka olasilık ekleme.

Yanıtını SADECE geçerli JSON formatında ver, başka hiçbir şey yazma, markdown kullanma:

{
  "bileskikler": [
    {
      "formul": "H2O",
      "iupac_adi": "su (dihidrojen monoksit)",
      "bag_turu": "polar kovalent",
      "hal": "sıvı (oda sıcaklığında)",
      "renk": "renksiz",
      "erime_noktasi": "0°C",
      "kaynama_noktasi": "100°C",
      "yogunluk": "1.0 g/cm³",
      "kullanim": "içme suyu, çözücü, metabolizma",
      "organik_mi": false,
      "fonksiyonel_grup": null,
      "organik_sinif": null,
      "elektroliz_anot": null,
      "elektroliz_katot": null,
      "geometri": "açısal (104.5°)",
      "polarite": "polar",
      "wikipedia_arama": "water"
    }
  ],
  "izotoplar": [
    {
      "element": "H",
      "izotoplar": [
        {"sembol": "¹H (Protiyum)", "kitle": 1, "durum": "kararlı", "kullanim": "en yaygın hidrojen izotopu, %99.98"},
        {"sembol": "²H (Döteryum)", "kitle": 2, "durum": "kararlı", "kullanim": "nükleer reaktörler, NMR"}
      ]
    }
  ],
  "bag_yapisi": "H2O molekülünde oksijen 2 hidrojenle polar kovalent bağ kurar. Açısal geometri (104.5°). Elektronegatiflik farkı 1.4 olup güçlü dipol moment oluşturur. Moleküller arası hidrojen bağları yüksek kaynama noktasına yol açar."
}

Her bileşik için wikipedia_arama alanına İngilizce Wikipedia arama terimi yaz (örn. "water", "sodium chloride", "sulfuric acid").
Sadece JSON döndür.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2500,
        temperature: 0.1,
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
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(200).json({ raw: text });
    }

    // Enrich each compound with PubChem CID + Wikipedia image
    const enriched = await Promise.all(
      (parsed.bileskikler || []).map(async (b) => {
        try {
          // PubChem CID for 2D structure
          const cidRes = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(b.formul)}/cids/JSON`
          );
          let cid = null;
          if (cidRes.ok) {
            const cidData = await cidRes.json();
            cid = cidData?.IdentifierList?.CID?.[0] || null;
          }

          // Wikipedia image for real-world photo
          let wiki_img = null;
          if (b.wikipedia_arama) {
            const wikiRes = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(b.wikipedia_arama)}`
            );
            if (wikiRes.ok) {
              const wikiData = await wikiRes.json();
              wiki_img = wikiData?.originalimage?.source || wikiData?.thumbnail?.source || null;
            }
          }

          return {
            ...b,
            pubchem_cid: cid,
            img_2d: cid ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG` : null,
            img_dogal: wiki_img,
            pubchem_url: cid ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}` : null,
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
