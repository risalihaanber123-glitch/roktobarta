require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getMongoUri } = require('../config/db');
const User = require('../models/User');

const districtsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/districts.json'), 'utf8'));
const upazilasData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/upazilas.json'), 'utf8'));

const districtToDiv = {};
const districtToCountry = {};
districtsData.forEach(div => {
  div.districts.forEach(d => {
    districtToDiv[d] = div.division;
    districtToCountry[d] = div.country;
  });
});

const bnToEnMap = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

function bnToEnDigits(str) {
  if (!str) return '';
  return str.replace(/[০-৯]/g, d => bnToEnMap[d] || d);
}

function cleanPhoneNumber(str) {
  if (!str) return '';
  let clean = bnToEnDigits(str).trim();
  clean = clean.replace(/[\s\-\(\)\t]/g, '');
  if (clean.startsWith('+88')) clean = clean.substring(3);
  if (clean.startsWith('8801')) clean = clean.substring(2);
  return clean;
}

const districtNormalizeMap = {
  'সিরাজগঞ্জ': 'সিরাজগঞ্জ',
  'দিনাজপুর': 'দিনাজপুর',
  'গাইবান্ধা': 'গাইবান্ধা',
  'কুড়িগ্রাম': 'কুড়িগ্রাম',
  'কুড়িগ্রাম': 'কুড়িগ্রাম',
  'লালমনিরহাট': 'লালমনিরহাট',
  'নীলফামারী': 'নীলফামারী',
  'পঞ্চগড়': 'পঞ্চগড়',
  'পঞ্চগড়': 'পঞ্চগড়',
  'রংপুর': 'রংপুর',
  'ঠাকুরগাঁও': 'ঠাকুরগাঁও'
};

function normalizeDistrictName(dist) {
  if (!dist) return '';
  let d = dist.split('-')[0].trim();
  return districtNormalizeMap[d] || d;
}

function matchUpazila(district, address) {
  const upList = upazilasData[district] || [];
  if (!upList.length) return district + ' সদর';

  const lowerAddr = (address || '').toLowerCase();

  for (const up of upList) {
    if (address && address.includes(up)) return up;
  }
  for (const up of upList) {
    const base = up.replace(/\s*সদর$/, '').trim();
    if (base && address && address.includes(base)) return up;
  }
  if (lowerAddr.includes('sadar') || lowerAddr.includes('সদর')) {
    const sadarUp = upList.find(u => u.includes('সদর'));
    if (sadarUp) return sadarUp;
  }
  const sadarUp = upList.find(u => u.includes('সদর'));
  return sadarUp || upList[0];
}

async function importNov1Donors() {
  const uri = getMongoUri();
  console.log('[Import] Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('[Import] Connected to MongoDB Atlas successfully.');

  // Pre-generate password hash
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('Donor@123456', salt);

  // Load existing phones and emails from MongoDB
  console.log('[Import] Fetching existing phones and emails from DB...');
  const existingUsers = await User.find({}, 'phone email').lean();
  const usedPhones = new Set();
  const usedEmails = new Set();

  let maxPlaceholder = 0;
  existingUsers.forEach(u => {
    if (u.phone) {
      usedPhones.add(u.phone);
      if (u.phone.startsWith('01997')) {
        const numPart = parseInt(u.phone.replace('01997', ''), 10);
        if (!isNaN(numPart) && numPart > maxPlaceholder) {
          maxPlaceholder = numPart;
        }
      }
    }
    if (u.email) usedEmails.add(u.email);
  });

  console.log(`[Import] Loaded ${usedPhones.size} existing phones (highest placeholder: ${maxPlaceholder}).`);

  // Read raw lines starting from 01-11-2026
  const rawPath = path.join(__dirname, '../raw_donors_input.txt');
  const allLines = fs.readFileSync(rawPath, 'utf8').split(/\r?\n/);
  const startIdx = allLines.findIndex(l => l.trim() === '01-11-2026');
  if (startIdx === -1) {
    throw new Error('01-11-2026 not found in raw_donors_input.txt');
  }

  const lines = allLines.slice(startIdx);
  console.log(`[Import] Parsing ${lines.length} lines from 01-11-2026 to Thakurgaon...`);

  let currentGroup = '';
  let currentDistrict = '';
  let currentUpazila = '';

  const rawBlocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line === 'গ্রুপ:') {
      if (lines[i + 1]) currentGroup = lines[i + 1].trim();
    }

    if (line === 'বর্তমান জেলা') {
      for (let j = 1; j <= 3; j++) {
        const candidate = lines[i + j] ? lines[i + j].trim() : '';
        if (candidate && candidate !== 'বর্তমান জেলা' && candidate !== 'সব জেলা') {
          currentDistrict = normalizeDistrictName(candidate);
          break;
        }
      }
    }

    if (line === 'বর্তমান উপজেলা') {
      for (let j = 1; j <= 3; j++) {
        const candidate = lines[i + j] ? lines[i + j].trim() : '';
        if (candidate && candidate !== 'বর্তমান উপজেলা' && candidate !== 'সব উপজেলা' && candidate !== 'নিজ জেলা' && candidate !== 'সব জেলা') {
          currentUpazila = candidate.split('-')[0].trim();
          break;
        }
      }
    }

    if (/^\d+\t/.test(lines[i])) {
      const block = [lines[i]];
      i++;
      while (
        i < lines.length &&
        !/^\d+\t/.test(lines[i]) &&
        !lines[i].includes('গ্রুপ:') &&
        !lines[i].includes('বর্তমান জেলা') &&
        !lines[i].includes('নং\tনাম\tঠিকানা')
      ) {
        block.push(lines[i]);
        i++;
      }

      rawBlocks.push({
        group: currentGroup,
        sectionDistrict: currentDistrict,
        sectionUpazila: currentUpazila,
        block
      });
      continue;
    }
    i++;
  }

  console.log(`[Import] Found ${rawBlocks.length} total donor blocks.`);

  let placeholderSeq = maxPlaceholder + 1;
  const newDonors = [];
  let skippedDuplicates = 0;
  const districtCounts = {};

  for (let idx = 0; idx < rawBlocks.length; idx++) {
    const d = rawBlocks[idx];
    const firstLine = d.block[0];
    const parts = firstLine.split('\t');
    const num = parts[0].trim();
    let rawName = parts[1] ? parts[1].trim() : '';
    let addressPart = parts.slice(2).join(' ').trim();

    let bio = '';
    let rawPhone = '';
    let homeDistrict = '';
    let status = '';
    let dateStr = '';

    for (let b = 1; b < d.block.length; b++) {
      const bline = d.block[b].trim();
      if (!bline) continue;

      if (bline.includes('নোটঃ') || bline.includes('নোট:')) {
        bio += (bio ? ' ' : '') + bline.replace(/\.\.\.\s*আরও\s*পড়ুন.*$/, '');
      } else if (bline.includes('নিজ জেলাঃ') || bline.includes('নিজ জেলা:')) {
        const phoneParts = bline.split('\t');
        const distMatch = bline.match(/নিজ জেলা[ঃ:]\s*([^\t]+)/);
        if (distMatch) {
          homeDistrict = normalizeDistrictName(distMatch[1].trim());
        }
        for (const p of phoneParts) {
          const cleanP = cleanPhoneNumber(p);
          if (cleanP.length >= 8 && (cleanP.startsWith('01') || cleanP.startsWith('9') || cleanP.includes('X') || cleanP.includes('*') || /^\d{8,15}$/.test(cleanP))) {
            rawPhone = cleanP;
          }
        }
      } else if (bline.includes('রক্তদানের সময়')) {
        status = bline;
      } else if (/\d+.*(January|February|March|April|May|June|July|August|September|October|November|December|\d{4})/i.test(bline)) {
        dateStr = bline;
      } else if (!bline.includes('আরও দেখুন') && !bline.includes('ক্লিনিক') && !bline.includes('রক্তবন্ধু') && !bline.includes('কুইক লিঙ্কস') && !bline.includes('©')) {
        addressPart += (addressPart ? ', ' : '') + bline;
      }
    }

    // Clean name
    const noteIdx = rawName.search(/নোট[ঃ:]/);
    if (noteIdx !== -1) {
      bio = rawName.substring(noteIdx).replace(/\.\.\.\s*আরও\s*পড়ুন.*$/, '').trim() + (bio ? ' ' + bio : '');
      rawName = rawName.substring(0, noteIdx).trim();
    }
    let cleanName = rawName.replace(/\[([^\]]+)\]\([^)]*\)/g, (m, p1) => p1).trim();
    if (!cleanName) cleanName = 'রক্তদাতা ' + num;
    if (cleanName.length > 80) cleanName = cleanName.substring(0, 80).trim();

    // Determine district
    let district = d.sectionDistrict || homeDistrict || 'ঠাকুরগাঁও';
    district = normalizeDistrictName(district);

    const division = districtToDiv[district] || 'রংপুর';
    const country = districtToCountry[district] || 'বাংলাদেশ';

    // Determine upazila
    const upazila = matchUpazila(district, addressPart);

    // Process Phone
    let finalPhone = rawPhone;
    let showPhonePublic = true;
    const isValidBDPhone = /^01[3-9]\d{8}$/.test(finalPhone);

    if (isValidBDPhone) {
      if (usedPhones.has(finalPhone)) {
        skippedDuplicates++;
        continue; // Skip exact duplicate phone numbers
      }
      usedPhones.add(finalPhone);
    } else {
      if (rawPhone && !rawPhone.includes('X') && !rawPhone.includes('*')) {
        bio = (bio ? bio + ' | ' : '') + `ফোন: ${rawPhone}`;
      }
      finalPhone = '01997' + String(placeholderSeq).padStart(6, '0');
      showPhonePublic = false;
      placeholderSeq++;
      usedPhones.add(finalPhone);
    }

    // Process Email
    let email = `donor_${finalPhone}@roktobarta.com`;
    if (usedEmails.has(email)) {
      email = `donor_${finalPhone}_${idx + 1}@roktobarta.com`;
    }
    usedEmails.add(email);

    // Process Last Donation Date & Availability
    let lastDonationDate = null;
    let isAvailable = true;

    if (dateStr) {
      const cleanedDateStr = dateStr.replace(/\s*-\s*/g, ' ').trim();
      const parsedDate = new Date(cleanedDateStr);
      if (!isNaN(parsedDate.getTime())) {
        lastDonationDate = parsedDate;
      }
    }

    if (status.includes('হয়নি')) {
      isAvailable = false;
    } else if (status.includes('হয়েছে')) {
      isAvailable = true;
    } else if (lastDonationDate) {
      const now = new Date();
      const diffDays = (now - lastDonationDate) / (1000 * 60 * 60 * 24);
      if (diffDays < 90) {
        isAvailable = false;
      }
    }

    if (bio.length > 300) bio = bio.substring(0, 300).trim();
    const area = addressPart.length > 200 ? addressPart.substring(0, 200).trim() : addressPart.trim();

    newDonors.push({
      name: cleanName,
      email,
      phone: finalPhone,
      passwordHash: defaultPasswordHash,
      role: 'user',
      country,
      division,
      district,
      upazila,
      area,
      bloodGroup: d.group || 'A+',
      gender: 'পুরুষ',
      isDonor: true,
      isAvailable,
      lastDonationDate,
      totalDonations: lastDonationDate ? 1 : 0,
      showPhonePublic,
      bio,
      isVerified: true
    });

    districtCounts[district] = (districtCounts[district] || 0) + 1;
  }

  console.log(`[Import] Prepared ${newDonors.length} donors (Skipped ${skippedDuplicates} duplicate phones).`);
  console.log('[Import] Breakdown by District to be added:', districtCounts);

  // Batch insert into MongoDB
  const BATCH_SIZE = 500;
  let insertedTotal = 0;

  for (let b = 0; b < newDonors.length; b += BATCH_SIZE) {
    const chunk = newDonors.slice(b, b + BATCH_SIZE);
    try {
      const result = await User.insertMany(chunk, { ordered: false });
      insertedTotal += result.length;
      console.log(`[Import] Inserted batch ${Math.floor(b / BATCH_SIZE) + 1}: ${result.length} donors.`);
    } catch (err) {
      if (err.insertedDocs) {
        insertedTotal += err.insertedDocs.length;
        console.log(`[Import] Batch ${Math.floor(b / BATCH_SIZE) + 1} partial insert: ${err.insertedDocs.length} donors.`);
      } else {
        console.error(`[Import Error in batch]:`, err.message);
      }
    }
  }

  const finalCount = await User.countDocuments({ isDonor: true });
  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Newly Inserted: ${insertedTotal} donors`);
  console.log(`Total Donors in Database Now: ${finalCount}`);

  // Also update real_donors.json for local backup
  const realDonorsPath = path.join(__dirname, '../data/real_donors.json');
  if (fs.existsSync(realDonorsPath)) {
    const existingReal = JSON.parse(fs.readFileSync(realDonorsPath, 'utf8'));
    newDonors.forEach(nd => {
      existingReal.push({
        ...nd,
        lastDonationDate: nd.lastDonationDate ? nd.lastDonationDate.toISOString() : null
      });
    });
    fs.writeFileSync(realDonorsPath, JSON.stringify(existingReal, null, 2), 'utf8');
    console.log(`[Import] Updated real_donors.json cache (Total: ${existingReal.length} records).`);
  }

  await mongoose.disconnect();
}

importNov1Donors().catch(err => {
  console.error('[Fatal Import Error]', err);
  process.exit(1);
});
