// CampusHub demo data (stage 21a). Everything here is fictional.
// IDs start with "demo" and contain no "_" (firestore.rules split some IDs on "_").
// Times are given as "days ago" so the admin charts show a realistic month.

export const PROJECT_ID = "campushub-c2df6";
export const CAMPUS = "Strategy First Mandalay";

// ---- Accounts --------------------------------------------------------------
export const USERS = [
  {
    uid: "demoAyeChan", email: "aye.chan@demo.campushub.test", username: "ayechan", fullName: "Aye Chan",
    department: "Computing", graduationYear: "2027", studentId: "SFM-2024-0142",
    bio: "Second-year computing student. Selling things I no longer need and tutoring maths.",
    approved: true, banned: false, role: "student", joinedDaysAgo: 29,
  },
  {
    uid: "demoMinKhant", email: "min.khant@demo.campushub.test", username: "minkhant", fullName: "Min Khant",
    department: "Business Management", graduationYear: "2026", studentId: "SFM-2023-0388",
    bio: "Business student, part-time laptop fixer.",
    approved: true, banned: false, role: "student", joinedDaysAgo: 27,
  },
  {
    // Pending, and missing a student ID: use it to demonstrate admin review + Request changes.
    uid: "demoSuMyat", email: "su.myat@demo.campushub.test", username: "sumyat", fullName: "Su Myat",
    department: "Computing", graduationYear: "2028", studentId: "",
    bio: "", approved: false, banned: false, role: "student", joinedDaysAgo: 1,
  },
  {
    // Banned after posting a scam listing (see demoL12 and the audit log).
    uid: "demoZawLin", email: "zaw.lin@demo.campushub.test", username: "zawlin", fullName: "Zaw Lin",
    department: "Engineering", graduationYear: "2027", studentId: "SFM-2024-0907",
    bio: "", approved: true, banned: true, role: "student", joinedDaysAgo: 24,
  },
  {
    uid: "demoEmilyCarter", email: "emily.carter@demo.campushub.test", username: "emilyc", fullName: "Emily Carter",
    department: "Business Management", graduationYear: "2027", studentId: "SFM-2024-0215",
    bio: "Exchange student. Happy to help with English speaking practice.",
    approved: true, banned: false, role: "student", joinedDaysAgo: 19,
  },
  {
    uid: "demoJamesWalker", email: "james.walker@demo.campushub.test", username: "jamesw", fullName: "James Walker",
    department: "Computing", graduationYear: "2026", studentId: "SFM-2023-0451",
    bio: "Final-year computing student. Gamer and coffee addict.",
    approved: true, banned: false, role: "student", joinedDaysAgo: 16,
  },
  {
    uid: "demoAdmin", email: "admin@demo.campushub.test", username: "demoadmin", fullName: "Demo Admin",
    department: "Student Services", graduationYear: "", studentId: "STAFF-DEMO",
    bio: "Demo administrator account.", approved: true, banned: false, role: "admin", joinedDaysAgo: 30,
  },
];

// ---- Photos: free Unsplash licence (credited in the README) ----------------
// Each is an Unsplash photo page; the script downloads it and uploads it to Cloudinary.
export const PHOTOS = {
  calculator: "https://unsplash.com/photos/white-casio-calculator-r_m-JKJVto0",
  textbooks: "https://unsplash.com/photos/a-stack-of-three-books-sitting-on-top-of-each-other-f0yAcJ-YQ2Y",
  keyboard: "https://unsplash.com/photos/close-up-of-a-modern-mechanical-keyboard-with-display-VVTkIaD33_s",
  deskLamp: "https://unsplash.com/photos/grey-desk-lamp-on-top-of-office-desk-U6EXlQCZ938",
  headphones: "https://unsplash.com/photos/a-pair-of-headphones-sitting-on-top-of-a-wooden-table-FhuNZ8d2g_U",
  guitar: "https://unsplash.com/photos/brown-acoustic-guitar-on-white-background-CC7avUChQNU",
  books2: "https://unsplash.com/photos/a-stack-of-books-OLdMEEnPdnU",
  bedsideLamp: "https://unsplash.com/photos/white-and-clear-desk-lamp-on-white-wooden-nightstand-near-bed-M8iGdeTSOkg",
  yellowKeyboard: "https://unsplash.com/photos/yellow-and-white-keyboard-on-blue-and-white-surface-ZRoC_96HPnw",
  chair: "https://unsplash.com/photos/a-lamp-and-a-chair-gLBENb1GmK4",
};

// ---- Listings ----------------------------------------------------------------
// condition: new | like_new | good | fair ; meetupSpot: flexible | library | canteen | student_union | main_gate | sports_centre
export const LISTINGS = [
  { id: "demoL01", seller: "demoAyeChan", title: "Casio fx-991EX scientific calculator", category: "electronics", price: 38000, currency: "MMK", condition: "like_new", meetupSpot: "library", negotiable: true, photo: "calculator", daysAgo: 0.2,
    description: "Used for one semester of Engineering Maths. All buttons work, comes with the hard cover. Allowed in most exams." },
  { id: "demoL02", seller: "demoAyeChan", title: "Organic Chemistry textbooks (set of 3)", category: "books", price: 45000, currency: "MMK", condition: "good", meetupSpot: "library", negotiable: false, photo: "textbooks", daysAgo: 6,
    description: "Three course books for first-year chemistry. Some pencil notes in chapter 4, otherwise clean." },
  { id: "demoL03", seller: "demoAyeChan", title: "Mechanical keyboard with mini display", category: "electronics", price: 55, currency: "USD", condition: "like_new", meetupSpot: "student_union", negotiable: true, photo: "keyboard", daysAgo: 3,
    description: "Hot-swappable switches, white backlight and a small status screen. USB-C cable and keycap puller included." },
  { id: "demoL04", seller: "demoMinKhant", title: "Grey LED desk lamp", category: "dorm", price: 15000, currency: "MMK", condition: "good", meetupSpot: "canteen", negotiable: true, photo: "deskLamp", daysAgo: 9,
    description: "Adjustable arm, warm and cool light settings. Moving out of the hostel so it has to go." },
  { id: "demoL05", seller: "demoAyeChan", title: "Over-ear headphones", category: "electronics", price: 30, currency: "USD", condition: "good", meetupSpot: "main_gate", negotiable: true, photo: "headphones", daysAgo: 12,
    description: "Comfortable for long study sessions. Small scratch on the left cup, sound is perfect." },
  { id: "demoL06", seller: "demoMinKhant", title: "Acoustic guitar with soft case", category: "gaming", price: 120000, currency: "MMK", condition: "fair", meetupSpot: "student_union", negotiable: true, photo: "guitar", daysAgo: 15,
    description: "Good beginner guitar. Strings changed last month. Soft case has a broken zip pull." },
  { id: "demoL07", seller: "demoAyeChan", title: "Business Statistics books", category: "books", price: 20000, currency: "MMK", condition: "fair", meetupSpot: "library", negotiable: false, photo: "books2", daysAgo: 20, status: "sold",
    description: "Two statistics books for the Business Management course." },
  { id: "demoL08", seller: "demoMinKhant", title: "Lab coat, size M", category: "clothing", price: 12000, currency: "MMK", condition: "like_new", meetupSpot: "flexible", negotiable: false, photo: null, daysAgo: 2,
    description: "Worn twice for chemistry practicals. Washed and ironed." },
  { id: "demoL09", seller: "demoAyeChan", title: "Bedside lamp", category: "dorm", price: 18000, currency: "MMK", condition: "new", meetupSpot: "flexible", negotiable: false, photo: "bedsideLamp", daysAgo: 25,
    description: "Bought two by mistake. Still in the box." },
  { id: "demoL10", seller: "demoMinKhant", title: "Compact keyboard, yellow keycaps", category: "electronics", price: 40, currency: "USD", condition: "good", meetupSpot: "library", negotiable: true, photo: "yellowKeyboard", daysAgo: 7,
    description: "65% layout, quiet switches. Great for a small desk." },
  { id: "demoL11", seller: "demoAyeChan", title: "Reading chair", category: "dorm", price: 60000, currency: "MMK", condition: "good", meetupSpot: "flexible", negotiable: true, photo: "chair", daysAgo: 18,
    description: "Comfortable chair for a hostel room. You will need to carry it from the Main Gate." },
  // Removed by an admin for being a scam; its seller was then banned.
  { id: "demoL12", seller: "demoZawLin", title: "iPhone 15 Pro, half price, pay first", category: "electronics", price: 50000, currency: "MMK", condition: "new", meetupSpot: "flexible", negotiable: false, photo: null, daysAgo: 22, status: "removed", removedByAdmin: true,
    description: "Send the money first and I will deliver to your hostel." },
  // Reported and still open: use it to demonstrate handling a report.
  { id: "demoL13", seller: "demoZawLin", title: "Past exam papers with answers", category: "books", price: 25000, currency: "MMK", condition: "good", meetupSpot: "flexible", negotiable: false, photo: null, daysAgo: 23,
    description: "Answers for this year's finals. Message me." },
  { id: "demoL14", seller: "demoEmilyCarter", title: "University hoodie, size L", category: "clothing", price: 25000, currency: "MMK", condition: "good", meetupSpot: "canteen", negotiable: true, photo: null, daysAgo: 5,
    description: "Warm and barely worn. Too big for me." },
  { id: "demoL15", seller: "demoJamesWalker", title: "Wireless game controller", category: "gaming", price: 25, currency: "USD", condition: "like_new", meetupSpot: "student_union", negotiable: false, photo: null, daysAgo: 1.5,
    description: "Works with PC and console. Battery lasts about a week." },
];

// ---- Services ------------------------------------------------------------------
export const SERVICES = [
  { id: "demoS01", provider: "demoAyeChan", title: "Calculus and Statistics tutoring", category: "tutoring", price: 8000, currency: "MMK", meetupSpot: "library", negotiable: true, daysAgo: 4,
    description: "One-hour sessions for first and second-year students. I can share my own notes and past practice questions." },
  { id: "demoS02", provider: "demoMinKhant", title: "Laptop cleaning and Windows reinstall", category: "tech", price: 15000, currency: "MMK", meetupSpot: "student_union", negotiable: false, daysAgo: 10,
    description: "Dust cleaning, new thermal paste and a clean Windows install. Usually ready the same day." },
  { id: "demoS03", provider: "demoAyeChan", title: "Logo and poster design", category: "design", price: 20, currency: "USD", meetupSpot: "flexible", negotiable: true, daysAgo: 14,
    description: "Posters for club events and logos for small projects. Two rounds of changes included." },
  { id: "demoS04", provider: "demoMinKhant", title: "CV and assignment proofreading", category: "writing", price: 5000, currency: "MMK", meetupSpot: "flexible", negotiable: false, daysAgo: 21, status: "paused",
    description: "Grammar and clarity check for CVs and assignments up to 3,000 words. Paused during my exams." },
  { id: "demoS05", provider: "demoAyeChan", title: "Graduation photo shoots", category: "events", price: 35, currency: "USD", meetupSpot: "main_gate", negotiable: true, daysAgo: 8,
    description: "30-minute shoot around campus with 20 edited photos." },
  { id: "demoS06", provider: "demoMinKhant", title: "Bicycle tyre repair", category: "other", price: 3000, currency: "MMK", meetupSpot: "sports_centre", negotiable: false, daysAgo: 27,
    description: "Puncture repair and tyre change. Bring the bike to the Sports Centre." },
  { id: "demoS07", provider: "demoEmilyCarter", title: "English conversation practice", category: "tutoring", price: 6000, currency: "MMK", meetupSpot: "canteen", negotiable: true, daysAgo: 11,
    description: "Relaxed 45-minute speaking sessions to build confidence for presentations and interviews." },
];

// ---- Public questions (comments) ----------------------------------------------
export const COMMENTS = [
  { id: "demoC01", on: ["listings", "demoL03"], author: "demoMinKhant", text: "Does it come with the USB-C cable?", hoursAgo: 60 },
  { id: "demoC02", on: ["listings", "demoL03"], author: "demoAyeChan", text: "Yes, the cable and a keycap puller are included.", hoursAgo: 58 },
  { id: "demoC03", on: ["listings", "demoL06"], author: "demoAyeChan", text: "Are the strings new?", hoursAgo: 200 },
  { id: "demoC04", on: ["listings", "demoL06"], author: "demoMinKhant", text: "Changed last month, so they are still bright.", hoursAgo: 190 },
  { id: "demoC05", on: ["services", "demoS01"], author: "demoMinKhant", text: "Do you also teach Business Statistics?", hoursAgo: 80 },
  { id: "demoC06", on: ["services", "demoS01"], author: "demoAyeChan", text: "Yes, up to second-year level.", hoursAgo: 78 },
  { id: "demoC07", on: ["services", "demoS07"], author: "demoJamesWalker", text: "Can we do a session before my final presentation next week?", hoursAgo: 40 },
  { id: "demoC08", on: ["services", "demoS07"], author: "demoEmilyCarter", text: "Of course! Message me and we'll pick a time.", hoursAgo: 38 },
];

// ---- Saved items -----------------------------------------------------------------
export const SAVES = [
  { uid: "demoMinKhant", itemId: "demoL01", itemType: "listing", daysAgo: 0.1 },
  { uid: "demoMinKhant", itemId: "demoL03", itemType: "listing", daysAgo: 2.5 },
  { uid: "demoMinKhant", itemId: "demoS03", itemType: "service", daysAgo: 5 },
  { uid: "demoAyeChan", itemId: "demoL06", itemType: "listing", daysAgo: 9 },
  { uid: "demoJamesWalker", itemId: "demoL05", itemType: "listing", daysAgo: 1 },
  { uid: "demoJamesWalker", itemId: "demoS07", itemType: "service", daysAgo: 4 },
  { uid: "demoEmilyCarter", itemId: "demoS05", itemType: "service", daysAgo: 6 },
];

// ---- Chats -------------------------------------------------------------------------
// Each message: { by, hoursAgo, text } or an offer/meeting. Meeting time is in the future.
export const CHATS = [
  {
    item: "demoL03", itemType: "listing", buyer: "demoMinKhant",
    messages: [
      { id: "demoM01", by: "buyer", hoursAgo: 50, type: "text", text: "Is this still available?" },
      { id: "demoM02", by: "seller", hoursAgo: 49.5, type: "text", text: "Yes, it's still available." },
      { id: "demoM03", by: "buyer", hoursAgo: 49, type: "offer", amount: 50, status: "accepted", respondedHoursAgo: 48 },
      { id: "demoM04", by: "seller", hoursAgo: 48, type: "text", text: "Deal! When are you free to meet?" },
      { id: "demoM05", by: "buyer", hoursAgo: 3, type: "meeting", spot: "library", meetInDays: 2, meetHour: 14, status: "pending" },
    ],
    sellerRead: false, // the seller hasn't seen the meetup proposal yet (shows as unread)
  },
  {
    item: "demoS01", itemType: "service", buyer: "demoMinKhant",
    messages: [
      { id: "demoM06", by: "buyer", hoursAgo: 70, type: "text", text: "Are you available this week?" },
      { id: "demoM07", by: "seller", hoursAgo: 69, type: "text", text: "Yes, I'm available. Thursday at 4pm at the library?", reactions: { demoMinKhant: "like" } },
      { id: "demoM08", by: "buyer", hoursAgo: 68, type: "text", text: "Perfect, see you then." },
    ],
    sellerRead: true,
  },
  {
    item: "demoL04", itemType: "listing", buyer: "demoAyeChan",
    messages: [
      { id: "demoM09", by: "buyer", hoursAgo: 26, type: "text", text: "Can we negotiate the price?" },
      { id: "demoM10", by: "buyer", hoursAgo: 25.5, type: "offer", amount: 13000, status: "pending" },
    ],
    sellerRead: false,
  },
  {
    item: "demoL05", itemType: "listing", buyer: "demoJamesWalker",
    messages: [
      { id: "demoM11", by: "buyer", hoursAgo: 20, type: "text", text: "Hi! Do the headphones have a microphone?" },
      { id: "demoM12", by: "seller", hoursAgo: 19, type: "text", text: "No microphone, but the cable is detachable." },
      { id: "demoM13", by: "buyer", hoursAgo: 18.5, type: "text", text: "OK, thanks. I'll think about it." },
    ],
    sellerRead: true,
  },
];

// ---- Reports ----------------------------------------------------------------------
export const REPORTS = [
  // Handled: the scam listing was removed.
  { reporter: "demoMinKhant", item: "demoL12", itemType: "listing", owner: "demoZawLin", reason: "scam", note: "Asks for payment before meeting.", daysAgo: 22, status: "actioned", action: "removed", resolvedDaysAgo: 21.9 },
  // Open: for demonstrating the Reports tab.
  { reporter: "demoAyeChan", item: "demoL13", itemType: "listing", owner: "demoZawLin", reason: "prohibited", note: "Selling exam answers is against the rules.", daysAgo: 1, status: "open" },
];

// ---- Notifications -----------------------------------------------------------------
export const NOTIFICATIONS = [
  { id: "demoN01", uid: "demoAyeChan", type: "account_approved", daysAgo: 28 },
  { id: "demoN02", uid: "demoMinKhant", type: "account_approved", daysAgo: 26 },
  { id: "demoN05", uid: "demoEmilyCarter", type: "account_approved", daysAgo: 18 },
  { id: "demoN06", uid: "demoJamesWalker", type: "account_approved", daysAgo: 15 },
  { id: "demoN03", uid: "demoZawLin", type: "post_removed", itemType: "listing", itemId: "demoL12", itemTitle: "iPhone 15 Pro, half price, pay first", reason: "scam", daysAgo: 21.9 },
  { id: "demoN04", uid: "demoMinKhant", type: "report_handled", itemType: "listing", itemId: "demoL12", itemTitle: "iPhone 15 Pro, half price, pay first", outcome: "removed", daysAgo: 21.9 },
];

// ---- Admin audit log ----------------------------------------------------------------
export const ADMIN_LOG = [
  { id: "demoLog01", action: "user_approved", targetType: "user", targetId: "demoAyeChan", targetLabel: "Aye Chan", reason: "", daysAgo: 28 },
  { id: "demoLog02", action: "user_approved", targetType: "user", targetId: "demoMinKhant", targetLabel: "Min Khant", reason: "", daysAgo: 26 },
  { id: "demoLog03", action: "user_approved", targetType: "user", targetId: "demoZawLin", targetLabel: "Zaw Lin", reason: "", daysAgo: 23.5 },
  { id: "demoLog04", action: "report_actioned", targetType: "listing", targetId: "demoL12", targetLabel: "iPhone 15 Pro, half price, pay first", reason: "Removed after report: scam", daysAgo: 21.9 },
  { id: "demoLog05", action: "user_banned", targetType: "user", targetId: "demoZawLin", targetLabel: "Zaw Lin", reason: "After a report: scam", daysAgo: 21.8 },
  { id: "demoLog06", action: "announcement_updated", targetType: "announcement", targetId: "current", targetLabel: "Welcome to CampusHub", reason: "Shown to students", daysAgo: 3 },
  { id: "demoLog07", action: "user_approved", targetType: "user", targetId: "demoEmilyCarter", targetLabel: "Emily Carter", reason: "", daysAgo: 18 },
  { id: "demoLog08", action: "user_approved", targetType: "user", targetId: "demoJamesWalker", targetLabel: "James Walker", reason: "", daysAgo: 15 },
];

export const ANNOUNCEMENT = {
  title: "Welcome to CampusHub",
  body: "Meet only at the public campus spots in the app, and never pay before you have seen the item. Report anything suspicious.",
  daysAgo: 3,
};
