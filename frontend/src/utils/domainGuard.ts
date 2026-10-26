/**
 * SkillBridge AI - Domain & Safety Guardrail Utility
 * Handles non-tech domain detection ("in development / covered in the future")
 * and security / suspicious input protection (prompt injections, scam claims, script injection).
 */

export interface DomainCheckResult {
  isSafe: boolean;
  isTechDomain: boolean;
  detectedDomain?: string;
  alternatives?: string[];
  message?: string;
  type?: 'security' | 'domain' | 'ok';
}

export const NON_TECH_DOMAINS = [
  {
    name: 'Healthcare & Medicine',
    keywords: ['nurse', 'nursing', 'doctor', 'physician', 'dentist', 'dental', 'pharmacist', 'surgeon', 'paramedic', 'patient care', 'medical assistant', 'clinic'],
    alternatives: ['HealthTech Software Engineer', 'Clinical Data Analyst', 'Bioinformatics Specialist']
  },
  {
    name: 'Culinary & Hospitality',
    keywords: ['chef', 'cook', 'baker', 'baking', 'pastry', 'barista', 'bartender', 'restaurant manager', 'culinary', 'catering'],
    alternatives: ['FoodTech Platform Developer', 'POS Systems Specialist', 'Supply Chain Analyst']
  },
  {
    name: 'Legal & Law',
    keywords: ['lawyer', 'attorney', 'paralegal', 'judge', 'notary', 'legal assistant', 'litigation', 'solicitor'],
    alternatives: ['LegalTech Software Developer', 'Compliance & Security Analyst', 'Legal NLP Specialist']
  },
  {
    name: 'Trades & Construction',
    keywords: ['carpenter', 'carpentry', 'plumber', 'plumbing', 'electrician', 'welder', 'welding', 'mechanic', 'masonry', 'roofing'],
    alternatives: ['Smart Construction IoT Engineer', 'CAD/BIM Software Developer', 'Robotics Systems Programmer']
  },
  {
    name: 'Agriculture & Farming',
    keywords: ['farmer', 'farming', 'agriculture', 'agronomy', 'livestock', 'harvesting', 'tractor'],
    alternatives: ['AgriTech IoT Developer', 'Agricultural Geospatial Analyst', 'Automated Systems Engineer']
  },
  {
    name: 'Beauty & Personal Care',
    keywords: ['hair stylist', 'barber', 'cosmetology', 'esthetician', 'makeup artist', 'nail technician'],
    alternatives: ['E-Commerce Retail Developer', 'Computer Vision AR Filter Developer']
  },
  {
    name: 'Transportation & Logistics Non-Tech',
    keywords: ['truck driver', 'bus driver', 'taxi driver', 'flight attendant', 'warehouse packer', 'forklift operator'],
    alternatives: ['Logistics Fleet IoT Engineer', 'Supply Chain Systems Analyst', 'Autonomous Navigation Developer']
  }
];

export const TECH_MODIFIERS = [
  'software', 'developer', 'engineer', 'programmer', 'data', 'cloud', 'devops',
  'ai', 'machine learning', 'web', 'analyst', 'tech', 'technology', 'qa',
  'architect', 'systems', 'platform', 'frontend', 'backend', 'fullstack',
  'cybersecurity', 'security', 'database', 'infrastructure', 'network'
];

export function evaluateInputSafetyAndDomain(text: string, context?: string): DomainCheckResult {
  const combined = `${text || ''} ${context || ''}`.toLowerCase().trim();
  if (!combined || combined.length < 2) {
    return { isSafe: true, isTechDomain: true, type: 'ok' };
  }

  // 1. Security / Prompt Injection & Scam Guardrail
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    /system\s+override/i,
    /you\s+are\s+now\s+dan/i,
    /reveal\s+(the\s+)?(system\s+prompt|api\s+key|password)/i,
    /<script[\s>]/i,
    /javascript:/i,
    /drop\s+table/i,
    /grant\s+all\s+privileges/i,
    /bypass\s+all\s+verification/i,
    /give\s+me\s+100%\s+score/i,
    /mark\s+all\s+(as\s+)?verified/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(combined)) {
      return {
        isSafe: false,
        isTechDomain: true,
        type: 'security',
        message: 'Security Guardrail: Prompt injection and system override patterns are blocked. Skill Bridge AI relies on authentic codebase verification.'
      };
    }
  }

  const scamPatterns = [
    /built\s+(all\s+of\s+)?(google|facebook|amazon|meta|apple|netflix)\s+alone/i,
    /master(ed)?\s+all\s+\d+\s+languages/i,
    /can\s+hack\s+any\s+(bank|nasa|pentagon)/i,
    /send\s+money\s+to\s+get\s+verified/i,
    /guaranteed\s+\$?\d+k\s+job\s+in\s+24\s+hours/i
  ];

  for (const pattern of scamPatterns) {
    if (pattern.test(combined)) {
      return {
        isSafe: false,
        isTechDomain: true,
        type: 'security',
        message: 'Verification Guardrail: Suspicious or unverifiable portfolio claims detected. Please provide authentic, achievable technical goals.'
      };
    }
  }

  // 2. Non-Tech Domain Check
  const hasTechModifier = TECH_MODIFIERS.some(mod =>
    new RegExp(`(^|\\W)${mod}(\\W|$)`, 'i').test(combined)
  );

  if (!hasTechModifier) {
    for (const domain of NON_TECH_DOMAINS) {
      const isDomainMatch = domain.keywords.some(kw =>
        new RegExp(`(^|\\W)${kw}(\\W|$)`, 'i').test(combined)
      );
      if (isDomainMatch) {
        return {
          isSafe: true,
          isTechDomain: false,
          detectedDomain: domain.name,
          alternatives: domain.alternatives,
          type: 'domain',
          message: `Career pathways and skills in ${domain.name} are currently in active development and will be covered in upcoming platform updates. Skill Bridge AI currently specializes in technology, engineering, data, and AI domains.`
        };
      }
    }
  }

  return { isSafe: true, isTechDomain: true, type: 'ok' };
}
