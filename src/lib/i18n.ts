import { useStore } from "./store";

// Add a new language (e.g. "mr") by adding it to LANGS and a matching dictionary.
export const LANGS = { en: "English", hi: "हिन्दी" } as const;
export type Lang = keyof typeof LANGS;

const en = {
  demo: "Synthetic demo data", dashboard: "Dashboard", redistribution: "Redistribution", alerts: "Alerts",
  entry: "Stock Entry", federated: "Federated", methods: "Data & Methods", role: "Role",
  r_phc: "PHC Staff", r_district: "District Officer", r_state: "State Officer", r_national: "National View",
  phcs: "PHCs tracked", atRisk: "Medicines at risk", beds: "Beds available", attendance: "Staff attendance",
  state: "State", district: "District", medicine: "Medicine", all: "All",
  outbreak: "Outbreak Scenario", simulate: "Simulate outbreak", multiplier: "Demand multiplier",
  briefing: "Generate briefing", explain: "Explain + Draft order", approve: "Approve", approved: "Approved",
  suggestions: "Suggestions", auditLog: "Audit Log", stock: "Stock", daysLeft: "Days left", risk: "Risk",
  forecast: "14-day forecast", accuracy: "Forecast error (MAPE)", suggest: "Suggest action",
  photo: "Photo", voice: "Voice", manual: "Manual", attBeds: "Attendance/Beds", save: "Save", confirm: "Confirm & save",
  offline: "Offline — changes will sync when online", pending: "pending sync", aiFail: "AI unavailable — showing rule-based fallback.",
  decide: "AI recommends; officials decide.", noItems: "Nothing here yet.", retry: "Retry",
};
const hi: Record<keyof typeof en, string> = {
  demo: "कृत्रिम डेमो डेटा", dashboard: "डैशबोर्ड", redistribution: "पुनर्वितरण", alerts: "अलर्ट",
  entry: "स्टॉक प्रविष्टि", federated: "फ़ेडरेटेड", methods: "डेटा व पद्धति", role: "भूमिका",
  r_phc: "PHC स्टाफ़", r_district: "ज़िला अधिकारी", r_state: "राज्य अधिकारी", r_national: "राष्ट्रीय दृश्य",
  phcs: "ट्रैक किए गए PHC", atRisk: "जोखिम में दवाएँ", beds: "उपलब्ध बिस्तर", attendance: "स्टाफ़ उपस्थिति",
  state: "राज्य", district: "ज़िला", medicine: "दवा", all: "सभी",
  outbreak: "प्रकोप परिदृश्य", simulate: "प्रकोप सिमुलेट करें", multiplier: "माँग गुणक",
  briefing: "ब्रीफ़िंग बनाएँ", explain: "कारण + आदेश ड्राफ़्ट", approve: "स्वीकृत करें", approved: "स्वीकृत",
  suggestions: "सुझाव", auditLog: "ऑडिट लॉग", stock: "स्टॉक", daysLeft: "शेष दिन", risk: "जोखिम",
  forecast: "14-दिन पूर्वानुमान", accuracy: "पूर्वानुमान त्रुटि (MAPE)", suggest: "कार्रवाई सुझाएँ",
  photo: "फ़ोटो", voice: "आवाज़", manual: "मैनुअल", attBeds: "उपस्थिति/बिस्तर", save: "सहेजें", confirm: "पुष्टि कर सहेजें",
  offline: "ऑफ़लाइन — ऑनलाइन होने पर सिंक होगा", pending: "सिंक बाकी", aiFail: "AI उपलब्ध नहीं — नियम-आधारित सुझाव दिखाया गया।",
  decide: "AI सुझाव देता है; निर्णय अधिकारी लेते हैं।", noItems: "अभी कुछ नहीं।", retry: "फिर कोशिश करें",
};
const DICT: Record<Lang, Record<keyof typeof en, string>> = { en, hi };
export type TKey = keyof typeof en;
export function useT() {
  const lang = useStore((s) => s.lang);
  return (k: TKey) => DICT[lang][k] ?? en[k];
}
