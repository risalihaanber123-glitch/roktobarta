const {
  searchDistricts,
  searchUpazilas,
  resolveDistrict
} = require('../utils/locationSearch');

const isAllQuery = (q) => {
  if (!q) return true;
  const clean = q.trim().toLowerCase();
  return ['সব', 'সব জেলা', 'সব উপজেলা', 'সকল জেলা', 'সকল উপজেলা', 'সকল', 'all', 'any'].includes(clean);
};

/**
 * Autocomplete for districts (Bangla / English / Banglish input, Bangla output)
 * Includes "সব জেলা" (All Districts) option at top
 * GET /api/locations/districts?query=d&division=ঢাকা
 */
exports.getDistricts = (req, res) => {
  const { query, division } = req.query;
  const q = (query || '').trim();
  let data = searchDistricts(q, { division, limit: 70 });

  // If query is empty or matches 'সব' / 'all', place "সব জেলা" as the first choice
  const allOption = { n: 'সব জেলা', s: 'সকল জেলা' };
  if (!q || isAllQuery(q) || 'সব জেলা'.includes(q) || 'all'.includes(q.toLowerCase())) {
    data = [allOption, ...data.filter(d => d.n !== 'সব জেলা')];
  }

  return res.json({ success: true, count: data.length, data });
};

/**
 * Autocomplete for upazilas, optionally limited to a district
 * Includes "সব উপজেলা" (All Upazilas) option at top
 * GET /api/locations/upazilas?district=ঢাকা&query=মির
 */
exports.getUpazilas = (req, res) => {
  const { district, query } = req.query;
  const typed = district ? district.trim() : '';
  const isAllDistrict = isAllQuery(typed);
  const resolved = typed && !isAllDistrict ? resolveDistrict(typed) : '';

  // If a district was typed but is not recognized and not "সব"
  if (typed && !resolved && !isAllDistrict) {
    return res.json({ success: true, district: typed, count: 0, data: [] });
  }

  const q = (query || '').trim();
  let data = searchUpazilas(q, { district: resolved, limit: resolved ? 60 : 30 });

  // Place "সব উপজেলা" as the first choice
  const allUpazilaOption = {
    n: 'সব উপজেলা',
    s: resolved ? `${resolved}-এর সকল উপজেলা` : 'সকল উপজেলা'
  };

  if (!q || isAllQuery(q) || 'সব উপজেলা'.includes(q) || 'all'.includes(q.toLowerCase())) {
    data = [allUpazilaOption, ...data.filter(u => u.n !== 'সব উপজেলা')];
  }

  return res.json({ success: true, district: resolved, count: data.length, data });
};
