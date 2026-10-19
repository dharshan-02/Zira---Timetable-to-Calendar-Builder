# Official scenario evidence

Captured: 2026-10-19T15:18:38.398Z

> All four runs use synthetic fixtures because the provided brief names the organizer mock timetable page/PDF but contains no actual URL. These results show rule and tool behavior, not a run against the organizer source. TC1 and TC3 use isolated calendar simulations. The shared calendar was not changed by these benchmark runs. TC4 simulates OCR-like text damage; no image OCR engine ran.

## TC1

**Result:** PASS · synthetic fixture assertion

**Run ID:** `run-1792423118200-s6s4e`  
**Recorded at:** 2026-10-19T15:18:38.240Z

### Input

```text
Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Friday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Thursday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab
ENG101 | English Communication | Tuesday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture
ENG101 | English Communication | Thursday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture
CS101 | Programming Lab | Thursday | 14:00 | 16:00 | Lab-C05 | Dr. Sharma | Lab
```

### Expected result

All 10 rows parsed into recurring events. Each event has correct room assignment. No clashes expected.

### Actual result

```text
Parsed 10 events from 11 rows.
Unparsed rows: 0.
Clashes detected: 0.
All rooms assigned: Yes.
Recurrence set: Yes.
Isolated calendar simulation: 40 weekly occurrences checked; shared calendar unchanged.
Real calendar changes: none; the live workflow waits for explicit human approval.
Rooms: CS101→LH-301, CS101→LH-301, CS101→LH-301, MATH201→LH-205, MATH201→LH-205, MATH201→LH-205, PHY102→Lab-A12, ENG101→LH-102, ENG101→LH-102, CS101→Lab-C05.
```

### Evidence

```json
{
  "source": {
    "fixture": "tc1-weekly-timetable.txt",
    "input": "Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type\nCS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nCS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nCS101 | Introduction to Programming | Friday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nMATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture\nMATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture\nMATH201 | Linear Algebra | Thursday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture\nPHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab\nENG101 | English Communication | Tuesday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture\nENG101 | English Communication | Thursday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture\nCS101 | Programming Lab | Thursday | 14:00 | 16:00 | Lab-C05 | Dr. Sharma | Lab"
  },
  "events": [
    {
      "id": "evt-g9i9jh",
      "code": "CS101",
      "day": "Monday",
      "time": "09:00-10:00",
      "room": "LH-301",
      "type": "lecture"
    },
    {
      "id": "evt-vc5yrt",
      "code": "CS101",
      "day": "Wednesday",
      "time": "09:00-10:00",
      "room": "LH-301",
      "type": "lecture"
    },
    {
      "id": "evt-qm23p8",
      "code": "CS101",
      "day": "Friday",
      "time": "09:00-10:00",
      "room": "LH-301",
      "type": "lecture"
    },
    {
      "id": "evt-btet1e",
      "code": "MATH201",
      "day": "Monday",
      "time": "10:00-11:00",
      "room": "LH-205",
      "type": "lecture"
    },
    {
      "id": "evt-yz8zj2",
      "code": "MATH201",
      "day": "Wednesday",
      "time": "10:00-11:00",
      "room": "LH-205",
      "type": "lecture"
    },
    {
      "id": "evt-5fk2lu",
      "code": "MATH201",
      "day": "Thursday",
      "time": "10:00-11:00",
      "room": "LH-205",
      "type": "lecture"
    },
    {
      "id": "evt-ttn1np",
      "code": "PHY102",
      "day": "Tuesday",
      "time": "14:00-16:00",
      "room": "Lab-A12",
      "type": "lab"
    },
    {
      "id": "evt-ivlexk",
      "code": "ENG101",
      "day": "Tuesday",
      "time": "09:00-10:00",
      "room": "LH-102",
      "type": "lecture"
    },
    {
      "id": "evt-5w16yr",
      "code": "ENG101",
      "day": "Thursday",
      "time": "09:00-10:00",
      "room": "LH-102",
      "type": "lecture"
    },
    {
      "id": "evt-x5nsj8",
      "code": "CS101",
      "day": "Thursday",
      "time": "14:00-16:00",
      "room": "Lab-C05",
      "type": "lab"
    }
  ],
  "clashes": [],
  "unparsed": []
}
```

## TC2

**Result:** PASS · synthetic fixture assertion

**Run ID:** `run-1792423118254-a1d77`  
**Recorded at:** 2026-10-19T15:18:38.294Z

### Input

```text
Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab
EC201 | Digital Electronics | Tuesday | 14:30 | 16:00 | LH-404 | Prof. Iyer | Lecture
CS201 | Data Structures | Thursday | 09:00 | 10:00 | LH-301 | Dr. Kumar | Lecture
CS201 | Data Structures Lab | Thursday | 14:00 | 16:00 | Lab-C05 | Dr. Kumar | Lab
ME101 | Workshop Practice | Thursday | 15:00 | 17:00 | Workshop-B | Mr. Singh | Lab
```

### Expected result

Clashes detected: EC201 (Tue 14:30-16:00) overlaps PHY102 Lab (Tue 14:00-16:00). ME101 (Thu 15:00-17:00) overlaps CS201 Lab (Thu 14:00-16:00). Neither conflicting event is silently dropped.

### Actual result

```text
Parsed 9 events.
Clashes detected: 2.
EC201 vs PHY102 clash: DETECTED.
ME101 vs CS201 Lab clash: DETECTED.
All clash events preserved (not dropped): Yes.
Clash details:
  • PHY102 (lab) vs EC201 (lecture, elective) on Tuesday (14:30-16:00)
  • CS201 (lab) vs ME101 (lab, elective) on Thursday (15:00-16:00)
```

### Evidence

```json
{
  "source": {
    "fixture": "tc2-elective-clash.txt",
    "input": "Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type\nCS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nCS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nMATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture\nMATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture\nPHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab\nEC201 | Digital Electronics | Tuesday | 14:30 | 16:00 | LH-404 | Prof. Iyer | Lecture\nCS201 | Data Structures | Thursday | 09:00 | 10:00 | LH-301 | Dr. Kumar | Lecture\nCS201 | Data Structures Lab | Thursday | 14:00 | 16:00 | Lab-C05 | Dr. Kumar | Lab\nME101 | Workshop Practice | Thursday | 15:00 | 17:00 | Workshop-B | Mr. Singh | Lab"
  },
  "clashes": [
    {
      "id": "clash-1792423118267-2qtek",
      "eventA": "evt-ttn1np",
      "eventB": "evt-u2c5pz",
      "eventALabel": "PHY102 (lab)",
      "eventBLabel": "EC201 (lecture, elective)",
      "day": "Tuesday",
      "overlapStart": "14:30",
      "overlapEnd": "16:00",
      "reason": "Elective \"EC201\" clashes with core lab \"PHY102\". Overlap: 90 minutes (14:30 – 16:00)",
      "evidence": "Event A: [evt-ttn1np] PHY102 Tuesday 14:00-16:00 (Row 6 of tc2-elective-clash.txt)\nEvent B: [evt-u2c5pz] EC201 Tuesday 14:30-16:00 (Row 7 of tc2-elective-clash.txt)\nOverlap: 14:30-16:00 (90 min)"
    },
    {
      "id": "clash-1792423118268-r6shu",
      "eventA": "evt-s6q6vp",
      "eventB": "evt-gcgiog",
      "eventALabel": "CS201 (lab)",
      "eventBLabel": "ME101 (lab, elective)",
      "day": "Thursday",
      "overlapStart": "15:00",
      "overlapEnd": "16:00",
      "reason": "Elective \"ME101\" clashes with core lab \"CS201\". Overlap: 60 minutes (15:00 – 16:00)",
      "evidence": "Event A: [evt-s6q6vp] CS201 Thursday 14:00-16:00 (Row 9 of tc2-elective-clash.txt)\nEvent B: [evt-gcgiog] ME101 Thursday 15:00-17:00 (Row 10 of tc2-elective-clash.txt)\nOverlap: 15:00-16:00 (60 min)"
    }
  ],
  "events": [
    {
      "id": "evt-g9i9jh",
      "code": "CS101",
      "day": "Monday",
      "time": "09:00-10:00",
      "type": "lecture",
      "isElective": false
    },
    {
      "id": "evt-vc5yrt",
      "code": "CS101",
      "day": "Wednesday",
      "time": "09:00-10:00",
      "type": "lecture",
      "isElective": false
    },
    {
      "id": "evt-btet1e",
      "code": "MATH201",
      "day": "Monday",
      "time": "10:00-11:00",
      "type": "lecture",
      "isElective": false
    },
    {
      "id": "evt-yz8zj2",
      "code": "MATH201",
      "day": "Wednesday",
      "time": "10:00-11:00",
      "type": "lecture",
      "isElective": false
    },
    {
      "id": "evt-ttn1np",
      "code": "PHY102",
      "day": "Tuesday",
      "time": "14:00-16:00",
      "type": "lab",
      "isElective": false
    },
    {
      "id": "evt-u2c5pz",
      "code": "EC201",
      "day": "Tuesday",
      "time": "14:30-16:00",
      "type": "lecture",
      "isElective": true
    },
    {
      "id": "evt-vu9xty",
      "code": "CS201",
      "day": "Thursday",
      "time": "09:00-10:00",
      "type": "lecture",
      "isElective": false
    },
    {
      "id": "evt-s6q6vp",
      "code": "CS201",
      "day": "Thursday",
      "time": "14:00-16:00",
      "type": "lab",
      "isElective": false
    },
    {
      "id": "evt-gcgiog",
      "code": "ME101",
      "day": "Thursday",
      "time": "15:00-17:00",
      "type": "lab",
      "isElective": true
    }
  ],
  "preservedClashEvents": [
    "evt-ttn1np",
    "evt-u2c5pz",
    "evt-s6q6vp",
    "evt-gcgiog"
  ]
}
```

## TC3

**Result:** PASS · synthetic fixture assertion

**Run ID:** `run-1792423118305-zorie`  
**Recorded at:** 2026-10-19T15:18:38.345Z

### Input

```text
ORIGINAL TIMETABLE
Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab

REVISED TIMETABLE
Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-210 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Wednesday | 11:00 | 12:00 | LH-210 | Prof. Gupta | Lecture
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab
```

### Expected result

MATH201 Wednesday: time changed (10:00→11:00), room changed (LH-205→LH-210). MATH201 Monday: room changed (LH-205→LH-210). Other events unchanged — not duplicated or rewritten.

### Actual result

```text
Original: 5 events.
Revised: 5 events.
New events: 0 (none).
Updated events: 2 (evt-btet1e, evt-yz8zj2).
Unchanged events: 3 (evt-g9i9jh, evt-vc5yrt, evt-ttn1np).
Isolated simulated calendar: wrote 2 changed event(s); unchanged entries retained their original hashes.
Revised snapshot equals expected target: Yes. Shared calendar unchanged; real changes still require human approval.
Updated details:
  • evt-btet1e: MATH201 — hash hash-siouru → hash-16m93u
  • evt-yz8zj2: MATH201 — hash hash-5qfxfq → hash-o5tn6s
```

### Evidence

```json
{
  "source": {
    "originalFixture": "tc3-original.txt",
    "revisedFixture": "tc3-revised.txt",
    "originalInput": "Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type\nCS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nCS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nMATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture\nMATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture\nPHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab",
    "revisedInput": "Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type\nCS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nCS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nMATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-210 | Prof. Gupta | Lecture\nMATH201 | Linear Algebra | Wednesday | 11:00 | 12:00 | LH-210 | Prof. Gupta | Lecture\nPHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab"
  },
  "diff": {
    "newEvents": [],
    "updatedEvents": [
      "evt-btet1e",
      "evt-yz8zj2"
    ],
    "unchangedEvents": [
      "evt-g9i9jh",
      "evt-vc5yrt",
      "evt-ttn1np"
    ]
  },
  "isolatedCalendarWrites": [
    "evt-btet1e",
    "evt-yz8zj2"
  ],
  "onlyChangedWereWritten": true,
  "isolatedFinalCalendar": [
    {
      "id": "evt-g9i9jh",
      "code": "CS101",
      "hash": "hash-e87e36",
      "room": "LH-301",
      "day": "Monday",
      "time": "09:00-10:00"
    },
    {
      "id": "evt-vc5yrt",
      "code": "CS101",
      "hash": "hash-lett9u",
      "room": "LH-301",
      "day": "Wednesday",
      "time": "09:00-10:00"
    },
    {
      "id": "evt-btet1e",
      "code": "MATH201",
      "hash": "hash-16m93u",
      "room": "LH-210",
      "day": "Monday",
      "time": "10:00-11:00"
    },
    {
      "id": "evt-yz8zj2",
      "code": "MATH201",
      "hash": "hash-o5tn6s",
      "room": "LH-210",
      "day": "Wednesday",
      "time": "11:00-12:00"
    },
    {
      "id": "evt-ttn1np",
      "code": "PHY102",
      "hash": "hash-yend71",
      "room": "Lab-A12",
      "day": "Tuesday",
      "time": "14:00-16:00"
    }
  ],
  "originalEvents": [
    {
      "id": "evt-g9i9jh",
      "code": "CS101",
      "hash": "hash-e87e36",
      "room": "LH-301",
      "time": "09:00-10:00"
    },
    {
      "id": "evt-vc5yrt",
      "code": "CS101",
      "hash": "hash-lett9u",
      "room": "LH-301",
      "time": "09:00-10:00"
    },
    {
      "id": "evt-btet1e",
      "code": "MATH201",
      "hash": "hash-siouru",
      "room": "LH-205",
      "time": "10:00-11:00"
    },
    {
      "id": "evt-yz8zj2",
      "code": "MATH201",
      "hash": "hash-5qfxfq",
      "room": "LH-205",
      "time": "10:00-11:00"
    },
    {
      "id": "evt-ttn1np",
      "code": "PHY102",
      "hash": "hash-yend71",
      "room": "Lab-A12",
      "time": "14:00-16:00"
    }
  ],
  "revisedEvents": [
    {
      "id": "evt-g9i9jh",
      "code": "CS101",
      "hash": "hash-e87e36",
      "room": "LH-301",
      "time": "09:00-10:00"
    },
    {
      "id": "evt-vc5yrt",
      "code": "CS101",
      "hash": "hash-lett9u",
      "room": "LH-301",
      "time": "09:00-10:00"
    },
    {
      "id": "evt-btet1e",
      "code": "MATH201",
      "hash": "hash-16m93u",
      "room": "LH-210",
      "time": "10:00-11:00"
    },
    {
      "id": "evt-yz8zj2",
      "code": "MATH201",
      "hash": "hash-o5tn6s",
      "room": "LH-210",
      "time": "11:00-12:00"
    },
    {
      "id": "evt-ttn1np",
      "code": "PHY102",
      "hash": "hash-yend71",
      "room": "Lab-A12",
      "time": "14:00-16:00"
    }
  ]
}
```

## TC4

**Result:** PASS · synthetic fixture assertion

**Run ID:** `run-1792423118355-xm0m2`  
**Recorded at:** 2026-10-19T15:18:38.396Z

### Input

```text
Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
#@$%&* | ~~garbl3d t3xt~~ | M0nd@y | ??:?? | ??:?? | ??? | ??? | ???
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab
|||partially visible text with smudges|||
ENG101 | English Communication | Tuesday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture
```

### Expected result

Garbled row (row 4) and partially visible row (row 6) listed as unparsed with source location and reason. Other readable rows extracted successfully.

### Actual result

```text
Total rows in input: 7.
Successfully extracted: 4 events.
Unparsed rows: 2.
Each unparsed row has a reason: Yes.
Each unparsed row has source location: Yes.
Unparsed row details:
  • Row 4: "#@$%&* | ~~garbl3d t3xt~~ | M0nd@y | ??:?? | ??:?? | ??? | ?..." — Reason: Row contains garbled characters — likely OCR scan artifact
  • Row 6: "|||partially visible text with smudges|||..." — Reason: Row does not match expected timetable format (no course code, day, or time found)
```

### Evidence

```json
{
  "source": {
    "fixture": "tc4-scanned-ocr.txt",
    "input": "Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type\nCS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture\nMATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture\n#@$%&* | ~~garbl3d t3xt~~ | M0nd@y | ??:?? | ??:?? | ??? | ??? | ???\nPHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab\n|||partially visible text with smudges|||\nENG101 | English Communication | Tuesday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture"
  },
  "unparsedRows": [
    {
      "rowNumber": 4,
      "rawContent": "#@$%&* | ~~garbl3d t3xt~~ | M0nd@y | ??:?? | ??:?? | ??? | ??? | ???",
      "sourceFile": "tc4-scanned-ocr.txt",
      "reason": "Row contains garbled characters — likely OCR scan artifact",
      "sourceExcerpt": "#@$%&* | ~~garbl3d t3xt~~ | M0nd@y | ??:?? | ??:?? | ??? | ??? | ???"
    },
    {
      "rowNumber": 6,
      "rawContent": "|||partially visible text with smudges|||",
      "sourceFile": "tc4-scanned-ocr.txt",
      "reason": "Row does not match expected timetable format (no course code, day, or time found)",
      "sourceExcerpt": "|||partially visible text with smudges|||"
    }
  ],
  "parsedEvents": [
    {
      "id": "evt-g9i9jh",
      "code": "CS101",
      "day": "Monday",
      "confidence": "high"
    },
    {
      "id": "evt-btet1e",
      "code": "MATH201",
      "day": "Monday",
      "confidence": "high"
    },
    {
      "id": "evt-ttn1np",
      "code": "PHY102",
      "day": "Tuesday",
      "confidence": "high"
    },
    {
      "id": "evt-ivlexk",
      "code": "ENG101",
      "day": "Tuesday",
      "confidence": "high"
    }
  ],
  "parseMethod": "ocr",
  "note": "Synthetic OCR-like text fixture; no image OCR engine was run."
}
```
