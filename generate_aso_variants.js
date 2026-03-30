/**
 * Hello Prompt - Programmatic ASO Variant Generator
 * This script generates optimized metadata variants for the Chrome Web Store
 * following the "Rule of 5" and Manifest V3 constraints.
 */

const TARGET_KEYWORDS = [
    'AI Prompt Optimizer',
    'ChatGPT',
    'Gemini',
    'Prompt Engineering',
    'Secure AI',
    'Productivity',
    'AI प्रॉम्प्ट ऑप्टिमाइज़र',
    'सुरक्षित चैटजीपीटी',
    'प्रॉम्प्ट इंजीनियरिंग'
];

const VARIANTS = [
    {
        intent: 'Efficiency',
        title: 'AI Prompt Optimizer: Hello World GPT',
        shortDesc: 'Instant AI prompt optimizer for ChatGPT & Gemini. Boost productivity with 1-click secure prompt engineering.',
        benefit: 'Turn vague thoughts into high-fidelity AI commands instantly.'
    },
    {
        intent: 'Professional',
        title: 'Prompt Engineering Tool: Hello World GPT',
        shortDesc: 'Professional prompt engineering suite for AI teams. Secure, private, and optimized for ChatGPT enterprise workflows.',
        benefit: 'Master the art of prompting with professional-grade RACE frameworks.'
    },
    {
        intent: 'Hindi Optimizer',
        title: 'Hello Prompt: AI प्रॉम्प्ट ऑप्टिमाइज़र',
        shortDesc: 'ChatGPT और Gemini के लिए सुरक्षित AI प्रॉम्प्ट ऑप्टिमाइज़र। तेजी और गोपनीयता के साथ प्रॉम्प्ट इंजीनियरिंग।',
        benefit: 'हिंदी प्रॉम्प्ट को वर्ल्ड-क्लास निर्देशों में तुरंत बदलें।'
    }
];

function validateVariant(variant) {
    console.log(`\n🔍 Checking Variant: [${variant.intent}]`);

    // 1. Title Length Check (Max 75)
    if (variant.title.length > 75) {
        console.error(`❌ Title too long: ${variant.title.length}/75`);
    } else {
        console.log(`✅ Title Length: ${variant.title.length}/75`);
    }

    // 2. Short Description Length Check (Max 132)
    if (variant.shortDesc.length > 132) {
        console.error(`❌ Short Desc too long: ${variant.shortDesc.length}/132`);
    } else {
        console.log(`✅ Short Desc Length: ${variant.shortDesc.length}/132`);
    }

    // 3. Keyword Density "Rule of 5"
    const words = variant.shortDesc.toLowerCase().split(/\s+/);
    TARGET_KEYWORDS.forEach(kw => {
        const count = variant.shortDesc.toLowerCase().split(kw.toLowerCase()).length - 1;
        if (count > 5) {
            console.error(`❌ Keyword Spam Detected: "${kw}" appears ${count} times.`);
        } else if (count > 0) {
            console.log(`📝 Keyword Found: "${kw}" (${count} times)`);
        }
    });

    console.log('---');
}

VARIANTS.forEach(validateVariant);
