/**
 * Local Finder string dictionary — English, Hindi (Devanagari), Gujarati.
 *
 * `STRINGS[lang][key]` gives the template; `{var}` placeholders are filled by
 * `t(key, vars)` in hooks/useLanguage.ts. Every key MUST exist in all three
 * languages (enforced by lib/i18n/dictionary.test.ts).
 */
export type Lang = 'en' | 'hi' | 'gu';

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिं' },
  { code: 'gu', label: 'ગુ' },
];

/**
 * Pure translator: looks up `key` in `lang`, falls back to English for
 * missing keys, and fills `{var}` placeholders from `vars`.
 * Unknown keys resolve to the key itself (last-resort fallback).
 */
export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const table = STRINGS[lang] ?? STRINGS.en;
  const template = table[key] ?? STRINGS.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name) =>
    vars[name] !== undefined ? String(vars[name]) : m,
  );
}

export const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    // ── Search bar ───────────────────────────────────────────────
    'search.aria': 'Search places',
    'search.placeholder': 'Search places — e.g. pharmacy, chai…',
    'search.go': 'Go',
    'search.clear': 'Clear search',
    'search.aiParse': 'Parse with AI',
    'search.aiParseTitle': 'Understand my query with AI',

    // ── Category chips ───────────────────────────────────────────
    'chips.aria': 'Quick categories',
    'chips.pharmacy': 'Pharmacy',
    'chips.chai': 'Chai',
    'chips.atm': 'ATM',
    'chips.petrol': 'Petrol pump',
    'chips.clinic': 'Clinic',
    'chips.stationery': 'Stationery',
    'chips.mechanic': 'Mechanic',
    'chips.groceries': 'Groceries',

    // ── Filter bar ───────────────────────────────────────────────
    'filters.aria': 'Result filters',
    'filters.openNow': 'Open now',
    'filters.openNowOnly': 'Open now only',
    'filters.sort': 'Sort',
    'filters.sortAria': 'Sort results',
    'filters.radiusAria': 'Search radius',
    'filters.radiusUnit': '{n} km',
    'sort.best': 'Best match',
    'sort.nearest': 'Nearest',
    'sort.rated': 'Top rated',
    'sort.reviewed': 'Most reviewed',

    // ── Status badges (PlaceCard) ────────────────────────────────
    'badges.open': 'Open',
    'badges.closed': 'Closed',
    'badges.closesSoon': 'Closing soon',
    'badges.unknown': 'Hours unknown',
    'badges.noRating': 'No rating',
    'badges.rated': 'Rated {rating} out of 5',

    // ── Empty / error states ─────────────────────────────────────
    'empty.title': 'No places found',
    'empty.body': 'Try a different search — or a wider radius to look further away.',
    'empty.widen': 'Widen the radius',
    'error.quotaTitle': 'Search is busy right now',
    'error.quotaBody': "We've used up our live place searches for now. Please wait a bit and try again.",
    'error.rateTitle': 'Too many searches',
    'error.genericTitle': 'Something went wrong',
    'error.genericBody': "Couldn't reach the places service. Check your connection and try again.",
    'error.retry': 'Try again',

    // ── Home page ────────────────────────────────────────────────
    'page.welcomeTitle': 'What do you need nearby?',
    'page.welcomeBody':
      "Type what you're looking for — or tap a category above. Results show ratings, hours, distance and directions from live Google Maps data.",
    'page.searching': 'Searching…',
    'page.resultsOne': '1 place found',
    'page.resultsMany': '{count} places found',
    'page.demoData': 'Demo data',
    'page.demoDataTitle': 'Served from demo data instead of live SerpApi data',
    'page.cached': 'Cached',
    'page.cachedTitle': 'Served from the server cache',
    'page.list': 'List',
    'page.map': 'Map',
    'page.viewMode': 'View mode',
    'page.locating': 'Getting your location…',
    'page.geoAreaPrompt': 'Set your area:',
    'page.chooseCity': 'Choose your city',
    'page.retryLocation': 'Retry location',
    'page.shareSearch': 'Share this search',
    'page.backToTop': 'Back to top',
    'page.loadingResults': 'Loading results',

    // ── Toasts ───────────────────────────────────────────────────
    'toast.linkCopied': 'Link copied',
    'toast.copyFailed': 'Could not copy the link',
    'toast.aiFallback': 'Could not understand that — searching as typed',

    // ── Geolocation ──────────────────────────────────────────────
    'geo.denied': 'Location permission denied. Pick a city below instead.',
    'geo.unavailable': 'Could not get your location. Pick a city below instead.',
    'geo.unsupported': 'Geolocation is not supported in this browser.',

    // ── Navbar ───────────────────────────────────────────────────
    'nav.openMenu': 'Open menu',
    'nav.collapse': 'Minimise sidebar',
    'nav.expand': 'Expand sidebar',
    'nav.subtitle': 'find what you need nearby',
    'nav.morning': 'Good Morning',
    'nav.afternoon': 'Good Afternoon',
    'nav.evening': 'Good Evening',
    'nav.themeDark': 'Dark theme',
    'nav.themeLight': 'Light theme',
    'nav.toDark': 'Switch to dark theme',
    'nav.toLight': 'Switch to light theme',
    'nav.notifications': 'Notifications',
    'nav.locationAria': 'Location: {label}, radius {radius} kilometres',
    'nav.home': 'Home',
    'nav.saved': 'Saved',
    'nav.language': 'Language',

    // ── Place card actions ───────────────────────────────────────
    'card.save': 'Save {name}',
    'card.unsave': 'Remove {name} from saved',
    'card.reviews': '{count} reviews',

    // ── Place details sheet ──────────────────────────────────────
    'sheet.details': '{name} details',
    'sheet.close': 'Close details',
    'sheet.openInMaps': 'Open {name} in Google Maps',
    'sheet.photoOf': 'Photo of {name}',
    'sheet.weeklyHours': 'Weekly hours',
    'sheet.copyAddress': 'Copy address',
    'sheet.addressCopied': 'Address copied',
    'sheet.away': '{distance} away',
    'sheet.call': 'Call',
    'sheet.callAria': 'Call {name}',
    'sheet.directions': 'Directions',
    'sheet.directionsAria': 'Get directions to {name}',
    'sheet.website': 'Website',
    'sheet.websiteAria': 'Visit {name} website',
    'sheet.save': 'Save',
    'sheet.saved': 'Saved',
    'sheet.share': 'Share',
    'sheet.shareAria': 'Share {name}',
    'sheet.reviewsSection': 'AI review summary',
    'sheet.fromReviews': 'From recent reviews',
    'sheet.liked': 'Liked:',
    'sheet.complaints': 'Complaints:',
    'sheet.basedOn': 'Based on {count} reviews',
    'sheet.privacy': 'Your location is sent to our server only to find places near you.',

    // ── Saved page ───────────────────────────────────────────────
    'saved.title': 'Saved places',
    'saved.emptyTitle': 'Nothing saved yet',
    'saved.emptyBody': 'Tap the heart on any result to save it here.',

    // ── PWA install (Phase 2 follow-up) ──────────────────────────
    'pwa.install': 'Install app',
  },

  hi: {
    // ── Search bar ───────────────────────────────────────────────
    'search.aria': 'जगहें खोजें',
    'search.placeholder': 'जगहें खोजें — जैसे फार्मेसी, चाय…',
    'search.go': 'जाएँ',
    'search.clear': 'खोज साफ़ करें',
    'search.aiParse': 'AI से समझें',
    'search.aiParseTitle': 'मेरा प्रश्न AI से समझवाएँ',

    // ── Category chips ───────────────────────────────────────────
    'chips.aria': 'त्वरित श्रेणियाँ',
    'chips.pharmacy': 'फार्मेसी',
    'chips.chai': 'चाय',
    'chips.atm': 'ATM',
    'chips.petrol': 'पेट्रोल पंप',
    'chips.clinic': 'क्लिनिक',
    'chips.stationery': 'स्टेशनरी',
    'chips.mechanic': 'मैकेनिक',
    'chips.groceries': 'किराना',

    // ── Filter bar ───────────────────────────────────────────────
    'filters.aria': 'परिणाम फ़िल्टर',
    'filters.openNow': 'अभी खुला',
    'filters.openNowOnly': 'सिर्फ़ अभी खुले',
    'filters.sort': 'क्रम',
    'filters.sortAria': 'परिणाम क्रमबद्ध करें',
    'filters.radiusAria': 'खोज की दूरी',
    'filters.radiusUnit': '{n} कि.मी.',
    'sort.best': 'सबसे उपयुक्त',
    'sort.nearest': 'सबसे नज़दीक',
    'sort.rated': 'सबसे ज़्यादा रेटेड',
    'sort.reviewed': 'सबसे ज़्यादा रिव्यू',

    // ── Status badges (PlaceCard) ────────────────────────────────
    'badges.open': 'खुला',
    'badges.closed': 'बंद',
    'badges.closesSoon': 'जल्द बंद होगा',
    'badges.unknown': 'समय की जानकारी नहीं',
    'badges.noRating': 'कोई रेटिंग नहीं',
    'badges.rated': '5 में से {rating} रेटिंग',

    // ── Empty / error states ─────────────────────────────────────
    'empty.title': 'कोई जगह नहीं मिली',
    'empty.body': 'कुछ और खोजकर देखें — या ज़्यादा दूर देखने के लिए रेडियस बढ़ाएँ।',
    'empty.widen': 'रेडियस बढ़ाएँ',
    'error.quotaTitle': 'खोज अभी व्यस्त है',
    'error.quotaBody': 'अभी के लिए हमारे लाइव प्लेस खोज खत्म हो गए हैं। थोड़ी देर रुकें और फिर कोशिश करें।',
    'error.rateTitle': 'बहुत ज़्यादा खोजें',
    'error.genericTitle': 'कुछ गड़बड़ हो गई',
    'error.genericBody': 'प्लेस सेवा तक नहीं पहुँच सके। अपना कनेक्शन जाँचें और फिर कोशिश करें।',
    'error.retry': 'फिर कोशिश करें',

    // ── Home page ────────────────────────────────────────────────
    'page.welcomeTitle': 'आपको आस-पास क्या चाहिए?',
    'page.welcomeBody':
      'जो खोज रहे हैं वो टाइप करें — या ऊपर कोई श्रेणी चुनें। लाइव Google Maps डेटा से रेटिंग, समय, दूरी और दिशा मिलती है।',
    'page.searching': 'खोज रहे हैं…',
    'page.resultsOne': '1 जगह मिली',
    'page.resultsMany': '{count} जगहें मिलीं',
    'page.demoData': 'डेमो डेटा',
    'page.demoDataTitle': 'लाइव SerpApi डेटा के बजाय डेमो डेटा से',
    'page.cached': 'कैश्ड',
    'page.cachedTitle': 'सर्वर कैश से दिया गया',
    'page.list': 'सूची',
    'page.map': 'नक्शा',
    'page.viewMode': 'दृश्य मोड',
    'page.locating': 'आपकी लोकेशन ले रहे हैं…',
    'page.geoAreaPrompt': 'अपना क्षेत्र चुनें:',
    'page.chooseCity': 'अपना शहर चुनें',
    'page.retryLocation': 'लोकेशन फिर आज़माएँ',
    'page.shareSearch': 'यह खोज साझा करें',
    'page.backToTop': 'ऊपर जाएँ',
    'page.loadingResults': 'परिणाम लोड हो रहे हैं',

    // ── Toasts ───────────────────────────────────────────────────
    'toast.linkCopied': 'लिंक कॉपी हो गया',
    'toast.copyFailed': 'लिंक कॉपी नहीं हो सका',
    'toast.aiFallback': 'समझ नहीं आया — जैसा लिखा है वैसा खोज रहे हैं',

    // ── Geolocation ──────────────────────────────────────────────
    'geo.denied': 'लोकेशन की अनुमति नहीं मिली। नीचे से शहर चुनें।',
    'geo.unavailable': 'आपकी लोकेशन नहीं मिल सकी। नीचे से शहर चुनें।',
    'geo.unsupported': 'इस ब्राउज़र में जियोलोकेशन समर्थित नहीं है।',

    // ── Navbar ───────────────────────────────────────────────────
    'nav.openMenu': 'मेन्यू खोलें',
    'nav.collapse': 'साइडबार छोटा करें',
    'nav.expand': 'साइडबार बड़ा करें',
    'nav.subtitle': 'आस-पास जो चाहिए, वो पाएँ',
    'nav.morning': 'सुप्रभात',
    'nav.afternoon': 'नमस्कार',
    'nav.evening': 'शुभ संध्या',
    'nav.themeDark': 'डार्क थीम',
    'nav.themeLight': 'लाइट थीम',
    'nav.toDark': 'डार्क थीम पर जाएँ',
    'nav.toLight': 'लाइट थीम पर जाएँ',
    'nav.notifications': 'सूचनाएँ',
    'nav.locationAria': 'लोकेशन: {label}, दूरी {radius} किलोमीटर',
    'nav.home': 'होम',
    'nav.saved': 'सहेजे हुए',
    'nav.language': 'भाषा',

    // ── Place card actions ───────────────────────────────────────
    'card.save': '{name} सहेजें',
    'card.unsave': '{name} को सहेजे हुओं से हटाएँ',
    'card.reviews': '{count} रिव्यू',

    // ── Place details sheet ──────────────────────────────────────
    'sheet.details': '{name} की जानकारी',
    'sheet.close': 'जानकारी बंद करें',
    'sheet.openInMaps': '{name} को Google Maps में खोलें',
    'sheet.photoOf': '{name} की तस्वीर',
    'sheet.weeklyHours': 'साप्ताहिक समय',
    'sheet.copyAddress': 'पता कॉपी करें',
    'sheet.addressCopied': 'पता कॉपी हो गया',
    'sheet.away': '{distance} दूर',
    'sheet.call': 'कॉल',
    'sheet.callAria': '{name} को कॉल करें',
    'sheet.directions': 'रास्ता',
    'sheet.directionsAria': '{name} तक का रास्ता देखें',
    'sheet.website': 'वेबसाइट',
    'sheet.websiteAria': '{name} की वेबसाइट देखें',
    'sheet.save': 'सहेजें',
    'sheet.saved': 'सहेजा गया',
    'sheet.share': 'साझा करें',
    'sheet.shareAria': '{name} साझा करें',
    'sheet.reviewsSection': 'AI रिव्यू सारांश',
    'sheet.fromReviews': 'हाल के रिव्यू से',
    'sheet.liked': 'पसंद आया:',
    'sheet.complaints': 'शिकायतें:',
    'sheet.basedOn': '{count} रिव्यू पर आधारित',
    'sheet.privacy': 'आपकी लोकेशन सिर्फ़ आस-पास की जगहें खोजने के लिए हमारे सर्वर को भेजी जाती है।',

    // ── Saved page ───────────────────────────────────────────────
    'saved.title': 'सहेजी हुई जगहें',
    'saved.emptyTitle': 'अभी कुछ सहेजा नहीं है',
    'saved.emptyBody': 'किसी भी परिणाम पर दिल दबाकर उसे यहाँ सहेजें।',

    // ── PWA install (Phase 2 follow-up) ──────────────────────────
    'pwa.install': 'ऐप इंस्टॉल करें',
  },

  gu: {
    // ── Search bar ───────────────────────────────────────────────
    'search.aria': 'સ્થળો શોધો',
    'search.placeholder': 'સ્થળો શોધો — જેમ કે ફાર્મસી, ચા…',
    'search.go': 'જાઓ',
    'search.clear': 'શોધ સાફ કરો',
    'search.aiParse': 'AI વડે સમજો',
    'search.aiParseTitle': 'મારો પ્રશ્ન AI વડે સમજાવો',

    // ── Category chips ───────────────────────────────────────────
    'chips.aria': 'ઝડપી શ્રેણીઓ',
    'chips.pharmacy': 'ફાર્મસી',
    'chips.chai': 'ચા',
    'chips.atm': 'ATM',
    'chips.petrol': 'પેટ્રોલ પંપ',
    'chips.clinic': 'ક્લિનિક',
    'chips.stationery': 'સ્ટેશનરી',
    'chips.mechanic': 'મિકેનિક',
    'chips.groceries': 'કરિયાણું',

    // ── Filter bar ───────────────────────────────────────────────
    'filters.aria': 'પરિણામ ફિલ્ટર',
    'filters.openNow': 'હમણાં ખુલ્લું',
    'filters.openNowOnly': 'ફક્ત હાલમાં ખુલ્લા',
    'filters.sort': 'ક્રમ',
    'filters.sortAria': 'પરિણામો ક્રમમાં ગોઠવો',
    'filters.radiusAria': 'શોધની ત્રિજ્યા',
    'filters.radiusUnit': '{n} કિ.મી.',
    'sort.best': 'સૌથી યોગ્ય',
    'sort.nearest': 'સૌથી નજીક',
    'sort.rated': 'સૌથી વધુ રેટેડ',
    'sort.reviewed': 'સૌથી વધુ રિવ્યૂ',

    // ── Status badges (PlaceCard) ────────────────────────────────
    'badges.open': 'ખુલ્લું',
    'badges.closed': 'બંધ',
    'badges.closesSoon': 'ટૂંક સમયમાં બંધ થશે',
    'badges.unknown': 'સમયની માહિતી નથી',
    'badges.noRating': 'કોઈ રેટિંગ નથી',
    'badges.rated': '5 માંથી {rating} રેટિંગ',

    // ── Empty / error states ─────────────────────────────────────
    'empty.title': 'કોઈ સ્થળ મળ્યું નથી',
    'empty.body': 'બીજું કંઈક શોધો — અથવા વધુ દૂર જોવા માટે રેડિયસ વધારો.',
    'empty.widen': 'રેડિયસ વધારો',
    'error.quotaTitle': 'શોધ અત્યારે વ્યસ્ત છે',
    'error.quotaBody': 'અત્યારે અમારી લાઇવ પ્લેસ શોધ પૂરી થઈ ગઈ છે. થોડી રાહ જુઓ અને ફરી પ્રયાસ કરો.',
    'error.rateTitle': 'ઘણી બધી શોધ',
    'error.genericTitle': 'કંઈક ખોટું થયું',
    'error.genericBody': 'પ્લેસ સેવા સુધી પહોંચી શકાયું નહીં. તમારું કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.',
    'error.retry': 'ફરી પ્રયાસ કરો',

    // ── Home page ────────────────────────────────────────────────
    'page.welcomeTitle': 'નજીકમાં તમારે શું જોઈએ છે?',
    'page.welcomeBody':
      'જે શોધો છો તે લખો — અથવા ઉપર કોઈ શ્રેણી પસંદ કરો. લાઇવ Google Maps ડેટા સાથે રેટિંગ, સમય, અંતર અને દિશા મળે છે.',
    'page.searching': 'શોધી રહ્યા છીએ…',
    'page.resultsOne': '1 સ્થળ મળ્યું',
    'page.resultsMany': '{count} સ્થળો મળ્યા',
    'page.demoData': 'ડેમો ડેટા',
    'page.demoDataTitle': 'લાઇવ SerpApi ડેટાને બદલે ડેમો ડેટામાંથી',
    'page.cached': 'કેશ્ડ',
    'page.cachedTitle': 'સર્વર કેશમાંથી આપેલું',
    'page.list': 'યાદી',
    'page.map': 'નકશો',
    'page.viewMode': 'દૃશ્ય મોડ',
    'page.locating': 'તમારું સ્થાન લઈ રહ્યા છીએ…',
    'page.geoAreaPrompt': 'તમારો વિસ્તાર પસંદ કરો:',
    'page.chooseCity': 'તમારું શહેર પસંદ કરો',
    'page.retryLocation': 'સ્થાન ફરી અજમાવો',
    'page.shareSearch': 'આ શોધ શેર કરો',
    'page.backToTop': 'ઉપર જાઓ',
    'page.loadingResults': 'પરિણામો લોડ થઈ રહ્યા છે',

    // ── Toasts ───────────────────────────────────────────────────
    'toast.linkCopied': 'લિંક કૉપિ થઈ',
    'toast.copyFailed': 'લિંક કૉપિ થઈ શકી નહીં',
    'toast.aiFallback': 'સમજાયું નહીં — જેમ લખ્યું છે તેમ શોધી રહ્યા છીએ',

    // ── Geolocation ──────────────────────────────────────────────
    'geo.denied': 'સ્થાનની પરવાનગી મળી નથી. નીચેથી શહેર પસંદ કરો.',
    'geo.unavailable': 'તમારું સ્થાન મળી શક્યું નથી. નીચેથી શહેર પસંદ કરો.',
    'geo.unsupported': 'આ બ્રાઉઝરમાં જિયોલોકેશન સપોર્ટેડ નથી.',

    // ── Navbar ───────────────────────────────────────────────────
    'nav.openMenu': 'મેન્યૂ ખોલો',
    'nav.collapse': 'સાઇડબાર નાનું કરો',
    'nav.expand': 'સાઇડબાર મોટું કરો',
    'nav.subtitle': 'નજીકમાં જે જોઈએ તે મેળવો',
    'nav.morning': 'શુભ સવાર',
    'nav.afternoon': 'નમસ્તે',
    'nav.evening': 'શુભ સંધ્યા',
    'nav.themeDark': 'ડાર્ક થીમ',
    'nav.themeLight': 'લાઇટ થીમ',
    'nav.toDark': 'ડાર્ક થીમ પર જાઓ',
    'nav.toLight': 'લાઇટ થીમ પર જાઓ',
    'nav.notifications': 'સૂચનાઓ',
    'nav.locationAria': 'સ્થાન: {label}, ત્રિજ્યા {radius} કિલોમીટર',
    'nav.home': 'હોમ',
    'nav.saved': 'સાચવેલ',
    'nav.language': 'ભાષા',

    // ── Place card actions ───────────────────────────────────────
    'card.save': '{name} સાચવો',
    'card.unsave': '{name} ને સાચવેલમાંથી કાઢો',
    'card.reviews': '{count} રિવ્યૂ',

    // ── Place details sheet ──────────────────────────────────────
    'sheet.details': '{name} ની માહિતી',
    'sheet.close': 'માહિતી બંધ કરો',
    'sheet.openInMaps': '{name} ને Google Maps માં ખોલો',
    'sheet.photoOf': '{name} નો ફોટો',
    'sheet.weeklyHours': 'સાપ્તાહિક સમય',
    'sheet.copyAddress': 'સરનામું કૉપિ કરો',
    'sheet.addressCopied': 'સરનામું કૉપિ થયું',
    'sheet.away': '{distance} દૂર',
    'sheet.call': 'કૉલ',
    'sheet.callAria': '{name} ને કૉલ કરો',
    'sheet.directions': 'રસ્તો',
    'sheet.directionsAria': '{name} સુધીનો રસ્તો જુઓ',
    'sheet.website': 'વેબસાઇટ',
    'sheet.websiteAria': '{name} ની વેબસાઇટ જુઓ',
    'sheet.save': 'સાચવો',
    'sheet.saved': 'સાચવેલ',
    'sheet.share': 'શેર કરો',
    'sheet.shareAria': '{name} શેર કરો',
    'sheet.reviewsSection': 'AI રિવ્યૂ સારાંશ',
    'sheet.fromReviews': 'તાજેતરના રિવ્યૂમાંથી',
    'sheet.liked': 'ગમ્યું:',
    'sheet.complaints': 'ફરિયાદો:',
    'sheet.basedOn': '{count} રિવ્યૂ પર આધારિત',
    'sheet.privacy': 'તમારું સ્થાન ફક્ત નજીકના સ્થળો શોધવા માટે અમારા સર્વરને મોકલવામાં આવે છે.',

    // ── Saved page ───────────────────────────────────────────────
    'saved.title': 'સાચવેલ સ્થળો',
    'saved.emptyTitle': 'હજુ કંઈ સાચવ્યું નથી',
    'saved.emptyBody': 'કોઈ પણ પરિણામ પર દિલ દબાવીને તેને અહીં સાચવો.',

    // ── PWA install (Phase 2 follow-up) ──────────────────────────
    'pwa.install': 'એપ ઇન્સ્ટોલ કરો',
  },
};
