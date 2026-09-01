export const BUSINESS_TYPES = [
    'ECOMMERCE', 'VISA_CONSULTANCY', 'EDUCATION_CONSULTANCY', 'EDTECH', 'AGENCY',
    'REAL_ESTATE', 'CLINIC_SERVICE', 'RESTAURANT', 'SAAS', 'OTHER',
] as const;

export type BusinessType = typeof BUSINESS_TYPES[number];
export type OfferingType = 'PRODUCT' | 'SERVICE' | 'COURSE' | 'PROGRAM' | 'PROPERTY' | 'PACKAGE' | 'MENU_ITEM' | 'OTHER_OFFERING';
export type GapPriority = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

export const BUSINESS_TYPE_OPTIONS: Array<{ value: BusinessType; label: string }> = [
    { value: 'ECOMMERCE', label: 'Ecommerce / Online store' },
    { value: 'VISA_CONSULTANCY', label: 'Visa consultancy' },
    { value: 'EDUCATION_CONSULTANCY', label: 'Education consultancy' },
    { value: 'EDTECH', label: 'Education / EdTech' },
    { value: 'AGENCY', label: 'Agency / Professional service' },
    { value: 'REAL_ESTATE', label: 'Real estate' },
    { value: 'CLINIC_SERVICE', label: 'Clinic / Service provider' },
    { value: 'RESTAURANT', label: 'Restaurant / Food business' },
    { value: 'SAAS', label: 'Software / SaaS' },
    { value: 'OTHER', label: 'Other' },
];

const aliases: Record<string, BusinessType> = {
    ecommerce: 'ECOMMERCE', 'e commerce': 'ECOMMERCE', shop: 'ECOMMERCE', store: 'ECOMMERCE', retail: 'ECOMMERCE', fashion: 'ECOMMERCE',
    'visa consultancy': 'VISA_CONSULTANCY', visa: 'VISA_CONSULTANCY', immigration: 'VISA_CONSULTANCY',
    'education consultancy': 'EDUCATION_CONSULTANCY', 'study abroad': 'EDUCATION_CONSULTANCY', admission: 'EDUCATION_CONSULTANCY',
    edtech: 'EDTECH', education: 'EDTECH', coaching: 'EDTECH', course: 'EDTECH', academy: 'EDTECH',
    agency: 'AGENCY', 'professional service': 'AGENCY', marketing: 'AGENCY',
    'real estate': 'REAL_ESTATE', property: 'REAL_ESTATE',
    clinic: 'CLINIC_SERVICE', healthcare: 'CLINIC_SERVICE', doctor: 'CLINIC_SERVICE', 'service provider': 'CLINIC_SERVICE',
    restaurant: 'RESTAURANT', food: 'RESTAURANT', cafe: 'RESTAURANT',
    saas: 'SAAS', software: 'SAAS',
    other: 'OTHER',
};

export function normalizeBusinessType(value: unknown): BusinessType | undefined {
    const normalized = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    if (!normalized) return undefined;
    const enumValue = normalized.replace(/ /g, '_').toUpperCase();
    if ((BUSINESS_TYPES as readonly string[]).includes(enumValue)) return enumValue as BusinessType;
    return aliases[normalized] || Object.entries(aliases).find(([key]) => normalized.includes(key))?.[1];
}

export function businessTypeLabel(value: unknown): string {
    const type = normalizeBusinessType(value);
    return BUSINESS_TYPE_OPTIONS.find((option) => option.value === type)?.label || 'Other';
}

export interface GapDefinition {
    id: string; question: string; priority: GapPriority; domain: string; terms?: string[]; source?: 'products' | 'offerings' | 'phone' | 'customType';
}

export type SetupQuestionControl = 'single' | 'multi' | 'yes_no' | 'currency' | 'duration' | 'text' | 'textarea' | 'contact' | 'date' | 'schedule';
export interface BusinessSetupQuestion extends GapDefinition { control: SetupQuestionControl; suggestions: string[]; customLabel?: string; }

const common: GapDefinition[] = [
    { id: 'contact', question: 'What contact number should customers use?', priority: 'IMPORTANT', domain: 'CONTACT', source: 'phone' },
    { id: 'faq', question: 'What questions do customers ask most often?', priority: 'OPTIONAL', domain: 'FAQ', terms: ['faq', 'frequently asked', 'common question'] },
];

const gaps: Record<BusinessType, GapDefinition[]> = {
    ECOMMERCE: [
        { id: 'catalog', question: 'Which products are currently available?', priority: 'CRITICAL', domain: 'PRODUCT', source: 'products' },
        { id: 'delivery_charge', question: 'What is the delivery charge?', priority: 'IMPORTANT', domain: 'DELIVERY', terms: ['delivery charge', 'shipping charge', 'delivery fee'] },
        { id: 'delivery_time', question: 'How long does delivery take?', priority: 'IMPORTANT', domain: 'DELIVERY', terms: ['delivery time', 'delivery days', 'shipping time'] },
        { id: 'cod', question: 'Is cash on delivery available?', priority: 'IMPORTANT', domain: 'PAYMENT', terms: ['cash on delivery', 'cod'] },
        { id: 'payment', question: 'Which payment methods do you accept?', priority: 'IMPORTANT', domain: 'PAYMENT', terms: ['payment method', 'bkash', 'nagad', 'card payment'] },
        { id: 'return', question: 'What is your return or exchange period?', priority: 'IMPORTANT', domain: 'RETURN', terms: ['return', 'exchange'] },
        { id: 'warranty', question: 'Do any products include a warranty?', priority: 'OPTIONAL', domain: 'WARRANTY', terms: ['warranty', 'guarantee'] },
        { id: 'order_process', question: 'How should a customer place an order?', priority: 'IMPORTANT', domain: 'ORDER', terms: ['place order', 'order process', 'checkout'] },
        { id: 'store_location', question: 'Do customers need a store or pickup location?', priority: 'OPTIONAL', domain: 'LOCATION', terms: ['store location', 'pickup location', 'showroom'] },
        ...common,
    ],
    VISA_CONSULTANCY: [
        { id: 'countries', question: 'Which countries do you serve?', priority: 'CRITICAL', domain: 'COUNTRY', terms: ['countries served', 'country', 'canada', 'australia', 'uk', 'usa'] },
        { id: 'visa_types', question: 'Which visa types do you support?', priority: 'CRITICAL', domain: 'VISA_TYPE', terms: ['visa type', 'student visa', 'tourist visa', 'work visa', 'business visa', 'family visa'] },
        { id: 'documents', question: 'What required documents can you confirm?', priority: 'IMPORTANT', domain: 'DOCUMENTS', terms: ['required document', 'documents required', 'passport'] },
        { id: 'eligibility', question: 'What eligibility criteria are explicitly supported?', priority: 'IMPORTANT', domain: 'ELIGIBILITY', terms: ['eligibility', 'eligible', 'requirements'] },
        { id: 'process', question: 'What are your consultation and application steps?', priority: 'IMPORTANT', domain: 'PROCESS', terms: ['processing step', 'application process', 'consultation process'] },
        { id: 'timeline', question: 'What processing-time guidance can you safely provide?', priority: 'IMPORTANT', domain: 'TIMELINE', terms: ['processing time', 'estimated time', 'working days', 'weeks'] },
        { id: 'fee', question: 'What is your consultation or service fee?', priority: 'IMPORTANT', domain: 'FEE', terms: ['consultation fee', 'service fee', 'consultancy fee'] },
        { id: 'government_fee', question: 'Which government or embassy fees are explicitly confirmed?', priority: 'OPTIONAL', domain: 'GOVERNMENT_FEE', terms: ['government fee', 'embassy fee'] },
        { id: 'office', question: 'What is your office address?', priority: 'IMPORTANT', domain: 'LOCATION', terms: ['office address', 'our office'] },
        { id: 'intake', question: 'Are any visa services tied to an admission or intake?', priority: 'OPTIONAL', domain: 'INTAKE', terms: ['intake', 'admission'] },
        { id: 'claims', question: 'Are there any success claims with evidence that may be stated?', priority: 'OPTIONAL', domain: 'SUPPORTED_CLAIM', terms: ['success rate', 'successful cases'] },
        { id: 'appointment', question: 'How does a customer book a consultation?', priority: 'CRITICAL', domain: 'APPOINTMENT', terms: ['book consultation', 'appointment process', 'booking'] },
        { id: 'handoff', question: 'When should SellPilot connect a customer to a human consultant?', priority: 'CRITICAL', domain: 'HANDOFF', terms: ['human consultant', 'human handoff', 'connect to consultant'] },
        ...common,
    ],
    EDUCATION_CONSULTANCY: [
        { id: 'countries', question: 'Which study destinations do you support?', priority: 'CRITICAL', domain: 'COUNTRY', terms: ['countries', 'study destination', 'canada', 'australia', 'uk', 'usa'] },
        { id: 'programs', question: 'Which institutions or programs do you support?', priority: 'CRITICAL', domain: 'PROGRAM', terms: ['university', 'institution', 'program', 'course'] },
        { id: 'intake', question: 'Which intakes are currently relevant?', priority: 'IMPORTANT', domain: 'INTAKE', terms: ['intake', 'spring', 'fall', 'semester'] },
        { id: 'entry', question: 'What entry and English-language requirements are confirmed?', priority: 'IMPORTANT', domain: 'ELIGIBILITY', terms: ['entry requirement', 'ielts', 'english requirement'] },
        { id: 'tuition', question: 'What tuition range can you confirm?', priority: 'IMPORTANT', domain: 'FEE', terms: ['tuition', 'course fee'] },
        { id: 'application', question: 'What is the application process?', priority: 'IMPORTANT', domain: 'PROCESS', terms: ['application process', 'required documents'] },
        { id: 'scholarship', question: 'What scholarship information is explicitly confirmed?', priority: 'OPTIONAL', domain: 'SCHOLARSHIP', terms: ['scholarship', 'funding'] },
        { id: 'consultancy_fee', question: 'What consultancy fee applies?', priority: 'OPTIONAL', domain: 'FEE', terms: ['consultancy fee', 'service fee'] },
        { id: 'visa_support', question: 'What visa support is included?', priority: 'OPTIONAL', domain: 'VISA_SUPPORT', terms: ['visa support', 'visa assistance'] },
        { id: 'appointment', question: 'How can a student book an appointment?', priority: 'CRITICAL', domain: 'APPOINTMENT', terms: ['appointment', 'book consultation'] },
        ...common,
    ],
    EDTECH: [
        { id: 'audience', question: 'Which classes, grades, or learners are these courses for?', priority: 'CRITICAL', domain: 'AUDIENCE', terms: ['class 9', 'class 10', 'grade', 'ssc', 'hsc', 'learner'] },
        { id: 'course', question: 'Which courses, subjects, or batches are available?', priority: 'CRITICAL', domain: 'COURSE', source: 'offerings' },
        { id: 'curriculum', question: 'Which board, curriculum, group, and subjects are supported?', priority: 'IMPORTANT', domain: 'CURRICULUM', terms: ['board', 'curriculum', 'science group', 'commerce group', 'subject'] },
        { id: 'schedule', question: 'What is the batch start date and class schedule?', priority: 'IMPORTANT', domain: 'SCHEDULE', terms: ['batch start', 'class schedule', 'routine'] },
        { id: 'duration', question: 'How long is each course or batch?', priority: 'IMPORTANT', domain: 'DURATION', terms: ['duration', 'number of classes', 'classes'] },
        { id: 'teacher', question: 'Who teaches each course?', priority: 'OPTIONAL', domain: 'TEACHER', terms: ['teacher', 'instructor', 'mentor'] },
        { id: 'fee', question: 'What is the course or batch fee?', priority: 'IMPORTANT', domain: 'FEE', terms: ['course fee', 'batch fee', 'price'] },
        { id: 'format', question: 'Are classes live, recorded, or both?', priority: 'IMPORTANT', domain: 'FORMAT', terms: ['live class', 'recorded class', 'online class'] },
        { id: 'enrollment', question: 'How does a student enroll?', priority: 'CRITICAL', domain: 'ENROLLMENT', terms: ['enroll', 'enrollment', 'admission process'] },
        { id: 'exam', question: 'Is there an exam, test, or mentorship system?', priority: 'OPTIONAL', domain: 'ASSESSMENT', terms: ['exam', 'test system', 'mentorship'] },
        { id: 'trial', question: 'Is a trial or free class available?', priority: 'OPTIONAL', domain: 'TRIAL', terms: ['trial class', 'free class'] },
        { id: 'platform', question: 'How do students access the learning platform?', priority: 'OPTIONAL', domain: 'ACCESS', terms: ['platform access', 'student portal', 'app access'] },
        { id: 'payment', question: 'Which payment methods and discounts are confirmed?', priority: 'OPTIONAL', domain: 'PAYMENT', terms: ['payment method', 'discount'] },
        { id: 'refund', question: 'What is the refund policy?', priority: 'OPTIONAL', domain: 'REFUND', terms: ['refund policy'] },
        ...common,
    ],
    AGENCY: [
        { id: 'services', question: 'Which services do you provide?', priority: 'CRITICAL', domain: 'SERVICE', source: 'offerings' },
        { id: 'packages', question: 'Do you offer packages or a starting price?', priority: 'IMPORTANT', domain: 'PACKAGE', terms: ['package', 'starting price'] },
        { id: 'deliverables', question: 'What deliverables are included?', priority: 'IMPORTANT', domain: 'DELIVERABLE', terms: ['deliverable', 'included'] },
        { id: 'timeline', question: 'What is the typical delivery timeline?', priority: 'IMPORTANT', domain: 'TIMELINE', terms: ['timeline', 'delivery time', 'working days'] },
        { id: 'revision', question: 'What is your revision policy?', priority: 'OPTIONAL', domain: 'POLICY', terms: ['revision'] },
        { id: 'portfolio', question: 'Which portfolio examples may SellPilot share?', priority: 'OPTIONAL', domain: 'PORTFOLIO', terms: ['portfolio', 'case study', 'our work'] },
        { id: 'target_client', question: 'Who is the ideal client for these services?', priority: 'OPTIONAL', domain: 'TARGET_CLIENT', terms: ['target client', 'ideal client'] },
        { id: 'quote', question: 'How should a customer request a quote or booking?', priority: 'CRITICAL', domain: 'BOOKING', terms: ['request a quote', 'booking process', 'book service'] },
        ...common,
    ],
    REAL_ESTATE: [
        { id: 'properties', question: 'Which properties are currently available?', priority: 'CRITICAL', domain: 'PROPERTY', source: 'offerings' },
        { id: 'property_type', question: 'Which property types do you handle?', priority: 'CRITICAL', domain: 'PROPERTY_TYPE', terms: ['apartment', 'flat', 'land', 'commercial property', 'property type'] },
        { id: 'sale_or_rent', question: 'Are your properties for sale, rent, or both?', priority: 'CRITICAL', domain: 'TRANSACTION_TYPE', terms: ['for sale', 'for rent', 'sale or rent'] },
        { id: 'price_range', question: 'What price or rent range can customers expect?', priority: 'IMPORTANT', domain: 'PRICING', terms: ['price range', 'rent range', 'starting price'] },
        { id: 'details', question: 'What location, price, size, rooms, and amenities are confirmed?', priority: 'IMPORTANT', domain: 'PROPERTY_DETAILS', terms: ['location', 'bedroom', 'bathroom', 'amenities', 'square feet'] },
        { id: 'viewing', question: 'How can a customer arrange a viewing?', priority: 'CRITICAL', domain: 'VIEWING', terms: ['viewing', 'site visit'] },
        { id: 'deposit', question: 'What booking or deposit rules apply?', priority: 'IMPORTANT', domain: 'BOOKING', terms: ['deposit', 'booking rule'] },
        { id: 'agent', question: 'Which contact agent handles property inquiries?', priority: 'IMPORTANT', domain: 'CONTACT_AGENT', terms: ['contact agent', 'sales agent'] },
        ...common,
    ],
    CLINIC_SERVICE: [
        { id: 'services', question: 'Which services or specialists are available?', priority: 'CRITICAL', domain: 'SERVICE', source: 'offerings' },
        { id: 'appointment', question: 'How can a customer book an appointment?', priority: 'CRITICAL', domain: 'APPOINTMENT', terms: ['appointment', 'booking'] },
        { id: 'hours', question: 'What are your working hours?', priority: 'IMPORTANT', domain: 'HOURS', terms: ['working hours', 'opening hours'] },
        { id: 'location', question: 'Where is the clinic or service location?', priority: 'IMPORTANT', domain: 'LOCATION', terms: ['address', 'location'] },
        { id: 'fees', question: 'Which service fees can be confirmed?', priority: 'OPTIONAL', domain: 'FEE', terms: ['fee', 'consultation charge'] },
        { id: 'preparation', question: 'Are there general appointment preparation instructions?', priority: 'OPTIONAL', domain: 'PREPARATION', terms: ['preparation instruction', 'before appointment'] },
        ...common,
    ],
    RESTAURANT: [
        { id: 'menu', question: 'Which menu items are currently available?', priority: 'CRITICAL', domain: 'MENU', source: 'offerings' },
        { id: 'delivery', question: 'What delivery areas and fees apply?', priority: 'IMPORTANT', domain: 'DELIVERY', terms: ['delivery area', 'delivery fee'] },
        { id: 'hours', question: 'What are your opening hours?', priority: 'IMPORTANT', domain: 'HOURS', terms: ['opening hours'] },
        { id: 'location', question: 'Where is the restaurant located?', priority: 'IMPORTANT', domain: 'LOCATION', terms: ['restaurant location', 'address'] },
        { id: 'reservation', question: 'Do you accept reservations, and how?', priority: 'OPTIONAL', domain: 'RESERVATION', terms: ['reservation'] },
        { id: 'payment', question: 'Which payment methods do you accept?', priority: 'IMPORTANT', domain: 'PAYMENT', terms: ['payment method', 'cash', 'card'] },
        { id: 'dietary', question: 'What dietary information can you confirm?', priority: 'OPTIONAL', domain: 'DIETARY', terms: ['vegetarian', 'vegan', 'halal', 'allergen'] },
        { id: 'offers', question: 'Which current offers are explicitly confirmed?', priority: 'OPTIONAL', domain: 'OFFER', terms: ['current offer', 'discount offer'] },
        ...common,
    ],
    SAAS: [
        { id: 'plans', question: 'Which plans and features are available?', priority: 'CRITICAL', domain: 'PLAN', source: 'offerings' },
        { id: 'pricing', question: 'What pricing and billing cycles apply?', priority: 'IMPORTANT', domain: 'PRICING', terms: ['pricing', 'monthly', 'annual', 'billing cycle'] },
        { id: 'limits', question: 'What limits apply to each plan?', priority: 'IMPORTANT', domain: 'LIMIT', terms: ['limit', 'usage'] },
        { id: 'trial', question: 'Is a trial available?', priority: 'OPTIONAL', domain: 'TRIAL', terms: ['free trial', 'trial'] },
        { id: 'onboarding', question: 'How does setup and onboarding work?', priority: 'IMPORTANT', domain: 'ONBOARDING', terms: ['onboarding', 'setup'] },
        { id: 'integrations', question: 'Which integrations are supported?', priority: 'OPTIONAL', domain: 'INTEGRATION', terms: ['integration', 'connects with'] },
        { id: 'support', question: 'What support channels and hours are included?', priority: 'IMPORTANT', domain: 'SUPPORT', terms: ['support channel', 'support hours'] },
        { id: 'cancellation', question: 'What is the cancellation or refund policy?', priority: 'IMPORTANT', domain: 'POLICY', terms: ['cancel', 'refund'] },
        ...common,
    ],
    OTHER: [
        { id: 'custom_type', question: 'What do you sell or provide?', priority: 'CRITICAL', domain: 'BUSINESS', source: 'customType' },
        { id: 'offerings', question: 'What products, services, programs, or other offerings are available?', priority: 'CRITICAL', domain: 'OFFERING', source: 'offerings' },
        { id: 'pricing', question: 'What prices, fees, or starting rates can you confirm?', priority: 'IMPORTANT', domain: 'PRICING', terms: ['price', 'fee', 'starting rate'] },
        { id: 'delivery', question: 'Do delivery, fulfillment, or service-area rules apply?', priority: 'OPTIONAL', domain: 'DELIVERY', terms: ['delivery', 'service area', 'fulfillment'] },
        { id: 'payment', question: 'Which payment methods do you accept?', priority: 'IMPORTANT', domain: 'PAYMENT', terms: ['payment method', 'cash', 'card', 'bkash'] },
        { id: 'support', question: 'How should customers contact support?', priority: 'IMPORTANT', domain: 'SUPPORT', terms: ['support', 'customer care'] },
        { id: 'policy', question: 'Which cancellation, return, or refund policy applies?', priority: 'OPTIONAL', domain: 'POLICY', terms: ['cancellation', 'return policy', 'refund policy'] },
        { id: 'process', question: 'How does a customer buy, book, or get started?', priority: 'IMPORTANT', domain: 'PROCESS', terms: ['buy', 'book', 'get started', 'order process'] },
        ...common,
    ],
};

const setupQuestionMeta: Partial<Record<BusinessType, Record<string, { control?: SetupQuestionControl; suggestions?: string[]; customLabel?: string }>>> = {
    ECOMMERCE: {
        delivery_charge: { control: 'currency', suggestions: ['Inside Dhaka ৳60', 'Inside Dhaka ৳80', 'Depends on location'], customLabel: 'Enter your delivery charges' },
        cod: { control: 'yes_no', suggestions: ['Yes', 'No', 'Selected orders or areas'] },
        return: { control: 'duration', suggestions: ['7 days', '14 days', 'No returns; exchange only'] },
        delivery_time: { control: 'duration', suggestions: ['1–2 days', '2–3 days', 'Depends on location'] },
        payment: { control: 'multi', suggestions: ['Cash on delivery', 'bKash / Nagad', 'Card / bank transfer'] },
        warranty: { control: 'single', suggestions: ['No warranty', 'Varies by product', 'Manufacturer warranty'] },
    },
    VISA_CONSULTANCY: {
        countries: { control: 'multi', suggestions: ['Canada', 'Australia', 'United Kingdom'] },
        visa_types: { control: 'multi', suggestions: ['Student visa', 'Visitor visa', 'Work visa'] },
        process: { control: 'textarea' }, fee: { control: 'currency' }, documents: { control: 'textarea' },
        appointment: { control: 'single', suggestions: ['In person', 'Phone / WhatsApp', 'Video consultation'] },
        handoff: { control: 'textarea' }, timeline: { control: 'duration' }, office: { control: 'contact' },
    },
    EDUCATION_CONSULTANCY: {
        countries: { control: 'multi', suggestions: ['Canada', 'Australia', 'United Kingdom'] },
        programs: { control: 'textarea' }, intake: { control: 'multi', suggestions: ['Spring', 'Summer', 'Fall'] },
        entry: { control: 'textarea' }, application: { control: 'textarea' }, appointment: { control: 'single', suggestions: ['In person', 'Phone / WhatsApp', 'Video consultation'] },
    },
    EDTECH: {
        audience: { control: 'multi', suggestions: ['SSC', 'HSC', 'University / professional'] },
        course: { control: 'textarea' }, schedule: { control: 'schedule' }, duration: { control: 'duration' }, fee: { control: 'currency' },
        format: { control: 'single', suggestions: ['Live', 'Recorded', 'Live + recorded'] }, enrollment: { control: 'textarea' },
        trial: { control: 'yes_no', suggestions: ['Yes', 'No', 'Selected courses'] },
    },
    AGENCY: { services: { control: 'textarea' }, packages: { control: 'currency' }, deliverables: { control: 'textarea' }, timeline: { control: 'duration' }, revision: { control: 'textarea' }, quote: { control: 'contact' } },
    REAL_ESTATE: { properties: { control: 'textarea' }, property_type: { control: 'multi', suggestions: ['Apartment / flat', 'Land', 'Commercial property'] }, sale_or_rent: { control: 'single', suggestions: ['For sale', 'For rent', 'Sale + rent'] }, price_range: { control: 'currency' }, details: { control: 'textarea' }, viewing: { control: 'contact' }, deposit: { control: 'currency' }, agent: { control: 'contact' } },
    CLINIC_SERVICE: { services: { control: 'textarea' }, appointment: { control: 'contact' }, hours: { control: 'schedule' }, location: { control: 'contact' }, fees: { control: 'currency' } },
    RESTAURANT: { menu: { control: 'textarea' }, delivery: { control: 'currency' }, hours: { control: 'schedule' }, location: { control: 'contact' }, reservation: { control: 'yes_no', suggestions: ['Yes', 'No', 'Call to confirm'] }, payment: { control: 'multi', suggestions: ['Cash', 'Mobile payment', 'Card'] } },
    SAAS: { plans: { control: 'textarea' }, pricing: { control: 'currency' }, limits: { control: 'textarea' }, trial: { control: 'yes_no', suggestions: ['Free trial', 'Demo only', 'No trial'] }, onboarding: { control: 'textarea' }, cancellation: { control: 'textarea' } },
    OTHER: { custom_type: { control: 'textarea' }, offerings: { control: 'textarea' }, pricing: { control: 'currency' }, delivery: { control: 'textarea' }, payment: { control: 'multi', suggestions: ['Cash', 'Mobile payment', 'Card / bank transfer'] }, support: { control: 'contact' }, policy: { control: 'textarea' }, process: { control: 'textarea' } },
};

export function getBusinessSetupQuestions(typeValue: unknown): BusinessSetupQuestion[] {
    const type = normalizeBusinessType(typeValue);
    if (!type) return [];
    return gaps[type]
        .filter((gap) => !['catalog', 'properties', 'menu', 'course', 'plans', 'services', 'offerings'].includes(gap.id) || gap.source !== 'products')
        .map((gap) => ({ ...gap, control: setupQuestionMeta[type]?.[gap.id]?.control || 'text', suggestions: setupQuestionMeta[type]?.[gap.id]?.suggestions || [], customLabel: setupQuestionMeta[type]?.[gap.id]?.customLabel }));
}

export interface BusinessProfileInput {
    businessType?: string; customBusinessType?: string; phone?: string;
}

export function getTrainingPlan(profile: BusinessProfileInput, context: { facts?: string; productCount?: number; offeringCount?: number; answeredKeys?: string[] } = {}) {
    const type = normalizeBusinessType(profile.businessType);
    if (!type) return {
        businessType: undefined,
        gaps: [{ id: 'business_type', question: 'What type of business do you run?', priority: 'CRITICAL' as const, domain: 'BUSINESS' }],
        ready: false,
    };
    const facts = String(context.facts || '').toLowerCase();
    const answeredKeys = new Set(context.answeredKeys || []);
    const isCovered = (gap: GapDefinition) => {
        if (answeredKeys.has(gap.id)) return true;
        if (gap.source === 'products') return Number(context.productCount || 0) > 0;
        if (gap.source === 'offerings') return Number(context.offeringCount || 0) > 0 || (type === 'EDTECH' && Number(context.productCount || 0) > 0);
        if (gap.source === 'phone') return Boolean(profile.phone);
        if (gap.source === 'customType') return Boolean(String(profile.customBusinessType || '').trim());
        return Boolean(gap.terms?.some((term) => facts.includes(term)));
    };
    const missing = gaps[type].filter((gap) => !isCovered(gap));
    return { businessType: type, gaps: missing, ready: !missing.some((gap) => gap.priority === 'CRITICAL') };
}

const faqTemplates: Partial<Record<BusinessType, string[]>> = {
    ECOMMERCE: ['What is the delivery charge?', 'What is the return or exchange period?', 'Is cash on delivery available?'],
    VISA_CONSULTANCY: ['Which countries do you support?', 'What documents are required?', 'How do I book a consultation?'],
    EDUCATION_CONSULTANCY: ['Which countries and institutions do you support?', 'Which intakes are open?', 'How do I start an application?'],
    EDTECH: ['Who is this course for?', 'How long is the batch?', 'Are classes live or recorded?'],
    AGENCY: ['What services do you provide?', 'How long does delivery take?', 'How do I request a quote?'],
    REAL_ESTATE: ['Which properties are available?', 'How do I arrange a viewing?', 'What deposit or booking rules apply?'],
    CLINIC_SERVICE: ['Which services or specialists are available?', 'How do I book an appointment?', 'What are your working hours?'],
    RESTAURANT: ['What is available on today’s menu?', 'Which areas do you deliver to?', 'Do you accept reservations?'],
    SAAS: ['Which plan is right for my team?', 'Is a free trial available?', 'How does onboarding work?'],
    OTHER: ['What do you provide?', 'How does a customer get started?', 'How can a customer contact you?'],
};

export function getFaqTemplates(typeValue: unknown) {
    const type = normalizeBusinessType(typeValue) || 'OTHER';
    return (faqTemplates[type] || ['What do you provide?', 'How does a customer get started?', 'How can a customer contact you?'])
        .map((question, index) => ({ id: `${type.toLowerCase()}-${index + 1}`, question }));
}

const leadFields: Record<BusinessType, string[]> = {
    ECOMMERCE: ['name', 'phone', 'desiredProduct', 'deliveryArea'],
    VISA_CONSULTANCY: ['name', 'phone', 'country', 'visaType', 'educationOrBackground'],
    EDUCATION_CONSULTANCY: ['name', 'phone', 'country', 'program', 'intake', 'educationOrBackground'],
    EDTECH: ['name', 'phone', 'classOrGrade', 'groupOrCurriculum', 'desiredCourseOrBatch'],
    AGENCY: ['name', 'phoneOrEmail', 'service', 'budget', 'timeline'],
    REAL_ESTATE: ['name', 'phone', 'propertyType', 'location', 'budget', 'moveInTimeline'],
    CLINIC_SERVICE: ['name', 'phone', 'requestedService', 'preferredAppointmentTime'],
    RESTAURANT: ['name', 'phone', 'orderOrReservation', 'deliveryArea'],
    SAAS: ['name', 'email', 'teamOrCompany', 'useCase', 'planInterest'],
    OTHER: ['name', 'phoneOrEmail', 'desiredOffering'],
};

export function getLeadFields(typeValue: unknown) { return leadFields[normalizeBusinessType(typeValue) || 'OTHER']; }

export function getConversationGuidance(typeValue: unknown) {
    const type = normalizeBusinessType(typeValue) || 'OTHER';
    const guidance: Record<BusinessType, { mode: string; discoveryQuestion: string; safety: string }> = {
        ECOMMERCE: { mode: 'commerce', discoveryQuestion: 'Ask for the relevant product, budget, size, color, or delivery area only when needed.', safety: 'Use canonical product price, variant, and stock. Keep qualification short and order-oriented.' },
        VISA_CONSULTANCY: { mode: 'consultancy', discoveryQuestion: 'Ask which country and visa type the customer wants to discuss.', safety: 'Never invent eligibility, embassy fees, success rates, processing times, or approval guarantees. Escalate case-specific judgment to a human consultant.' },
        EDUCATION_CONSULTANCY: { mode: 'consultancy', discoveryQuestion: 'Ask the intended country, program, and intake.', safety: 'Only state confirmed institutions, tuition, entry requirements, scholarships, and visa support.' },
        EDTECH: { mode: 'education', discoveryQuestion: 'Ask the learner’s class or group and desired subject or batch.', safety: 'Use confirmed course, schedule, teacher, fee, format, and enrollment facts.' },
        AGENCY: { mode: 'service', discoveryQuestion: 'Ask which service is needed, then budget and timeline when relevant.', safety: 'Do not promise deliverables, results, prices, or timelines beyond approved facts.' },
        REAL_ESTATE: { mode: 'property', discoveryQuestion: 'Ask property type, preferred location, and budget.', safety: 'Use confirmed availability, property details, deposit, and viewing rules.' },
        CLINIC_SERVICE: { mode: 'appointment', discoveryQuestion: 'Ask which service or specialist is needed and the preferred appointment time.', safety: 'Never diagnose, prescribe, or make unsupported medical claims. Route clinical questions to a qualified provider.' },
        RESTAURANT: { mode: 'menu', discoveryQuestion: 'Ask whether the customer wants menu help, delivery, or a reservation.', safety: 'Use confirmed menu availability, dietary information, fees, and opening hours.' },
        SAAS: { mode: 'software', discoveryQuestion: 'Ask the customer’s use case and team needs before suggesting a plan.', safety: 'Use confirmed plan features, limits, billing, trial, and cancellation terms.' },
        OTHER: { mode: 'flexible offering', discoveryQuestion: 'Ask what the customer is looking to buy, book, or receive.', safety: 'Do not assume Product fields; use only approved offering and process facts.' },
    };
    return { type, ...guidance[type], leadFields: getLeadFields(type) };
}

export function defaultOfferingType(typeValue: unknown): OfferingType {
    const type = normalizeBusinessType(typeValue) || 'OTHER';
    return ({ ECOMMERCE: 'PRODUCT', VISA_CONSULTANCY: 'SERVICE', EDUCATION_CONSULTANCY: 'PROGRAM', EDTECH: 'COURSE', AGENCY: 'SERVICE', REAL_ESTATE: 'PROPERTY', CLINIC_SERVICE: 'SERVICE', RESTAURANT: 'MENU_ITEM', SAAS: 'PACKAGE', OTHER: 'OTHER_OFFERING' } as Record<BusinessType, OfferingType>)[type];
}

export function knowledgeDomain(typeValue: unknown, value: string): string {
    const type = normalizeBusinessType(typeValue) || 'OTHER';
    const text = value.toLowerCase();
    return gaps[type].find((gap) => gap.terms?.some((term) => text.includes(term)))?.domain
        || (text.includes('faq') || text.includes('?') ? 'FAQ' : type === 'OTHER' ? 'OFFERING' : businessTypeLabel(type).toUpperCase().replace(/[^A-Z]+/g, '_'));
}

export function inferBusinessType(value: string) {
    const text = value.toLowerCase();
    const signals: Record<BusinessType, string[]> = {
        ECOMMERCE: ['add to cart', 'checkout', 'sku', 'stock', 'cash on delivery', 'product catalog'],
        VISA_CONSULTANCY: ['visa', 'embassy', 'passport', 'immigration', 'tourist visa', 'work permit'],
        EDUCATION_CONSULTANCY: ['study abroad', 'university application', 'scholarship', 'intake', 'ielts'],
        EDTECH: ['batch', 'class schedule', 'recorded class', 'course enrollment', 'ssc', 'hsc', 'curriculum'],
        AGENCY: ['our services', 'portfolio', 'request a quote', 'deliverables', 'revision'],
        REAL_ESTATE: ['property', 'bedroom', 'bathroom', 'square feet', 'viewing'],
        CLINIC_SERVICE: ['doctor', 'clinic', 'patient', 'appointment', 'specialist'],
        RESTAURANT: ['menu', 'reservation', 'dine in', 'food delivery', 'restaurant'],
        SAAS: ['pricing plan', 'free trial', 'subscription', 'integration', 'software'],
        OTHER: [],
    };
    const scored = Object.entries(signals).map(([type, terms]) => ({ type: type as BusinessType, matches: terms.filter((term) => text.includes(term)) }));
    scored.sort((a, b) => b.matches.length - a.matches.length);
    if (!scored[0].matches.length) return undefined;
    return { businessType: scored[0].type, confidence: Math.min(.95, .55 + scored[0].matches.length * .1), evidence: scored[0].matches.slice(0, 4) };
}

export function safeReferenceInsights(value: string, typeValue: unknown) {
    const type = normalizeBusinessType(typeValue) || inferBusinessType(value)?.businessType || 'OTHER';
    const definitions = gaps[type];
    const text = value.toLowerCase();
    const themes = definitions.filter((gap) => gap.terms?.some((term) => text.includes(term))).map((gap) => gap.domain);
    return {
        businessTypeHint: type,
        sectionIdeas: [...new Set(themes)].slice(0, 12),
        questionIdeas: definitions.filter((gap) => themes.includes(gap.domain)).map((gap) => gap.question).slice(0, 8),
        safety: 'Structure and question ideas only. No prices, contacts, addresses, claims, products, policies, or guarantees were imported.',
    };
}

export function testPrompts(typeValue: unknown) {
    const type = normalizeBusinessType(typeValue) || 'OTHER';
    return ({
        ECOMMERCE: ['5000 er moddhe smartwatch dekhaw'], VISA_CONSULTANCY: ['Canada student visa niye jante chai'],
        EDUCATION_CONSULTANCY: ['Canada Fall intake er program niye jante chai'], EDTECH: ['SSC 27 science er batch ache?'],
        AGENCY: ['Facebook ads service koto?'], REAL_ESTATE: ['Dhanmondi te 3 bedroom flat ache?'],
        CLINIC_SERVICE: ['Appointment kivabe book korbo?'], RESTAURANT: ['Ajke ki menu available?'],
        SAAS: ['Small team er jonno kon plan ta suitable?'], OTHER: ['Apnara ki service den?'],
    } as Record<BusinessType, string[]>)[type];
}
