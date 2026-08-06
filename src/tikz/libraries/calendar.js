export const tikzLibrary = {
  "name": "calendar",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:createCalendar/calendarLayout",
  "features": [
    "date ranges",
    "week list and week list sunday",
    "day list downward, upward, right, and left",
    "month list weekday offsets",
    "day/month spacing",
    "month label above centered",
    "month label left",
    "day and month text shorthands",
    "weekday, weekend, workday, equals, between, and day-of-month conditions",
    "named date anchors"
  ],
  "implements": [
    "date ranges",
    "week list and week list sunday",
    "day list downward, upward, right, and left",
    "month list weekday offsets",
    "day/month spacing",
    "month label above centered",
    "month label left",
    "day and month text shorthands",
    "weekday, weekend, workday, equals, between, and day-of-month conditions",
    "named date anchors"
  ],
  "localSourceReviewed": true,
  "notes": "Reviewed against TeX Live 2025 calendar source and manual. Week lists, all four linear day-list directions, and month lists follow PGF's Monday-first placement plus day/month shifts; month-list rows use the first day of the month even if the range starts later. month label left uses PGF's base-east left-edge placement. Localized names, other month-label variants, custom day/month code, and executable calendar hooks remain unsupported."
};
