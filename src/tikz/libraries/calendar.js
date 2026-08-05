export const tikzLibrary = {
  "name": "calendar",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:createCalendar/calendarLayout",
  "features": [
    "date ranges",
    "week list and week list sunday",
    "day/month spacing",
    "month label above centered",
    "day and month text shorthands",
    "weekday, weekend, workday, equals, between, and day-of-month conditions",
    "named date anchors"
  ],
  "implements": [
    "date ranges",
    "week list and week list sunday",
    "day/month spacing",
    "month label above centered",
    "day and month text shorthands",
    "weekday, weekend, workday, equals, between, and day-of-month conditions",
    "named date anchors"
  ],
  "localSourceReviewed": true,
  "notes": "Week-list placement follows PGF's Monday-first calendar advancement and month yshift rule. day/month list variants, localized names, and executable calendar hooks remain unsupported."
};
