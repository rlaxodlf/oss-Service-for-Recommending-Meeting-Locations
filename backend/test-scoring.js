const { rankSlots } = require("./rules/scoring");

const slots = [
    {
        slotId: "mon-0900-1030",
        day: "mon",
        start: "09:00",
        end: "10:30",
        duration: 90
    },
    {
        slotId: "mon-1200-1800",
        day: "mon",
        start: "12:00",
        end: "18:00",
        duration: 360
    },
    {
        slotId: "wed-1500-1800",
        day: "wed",
        start: "15:00",
        end: "18:00",
        duration: 180
    }
];

const members = [
    {
        nickname: "민수",
        preferred: ["afternoon"]
    },
    {
        nickname: "철수",
        preferred: ["morning"]
    }
];

const ranked = rankSlots(slots, members);

console.log(JSON.stringify(ranked, null, 2));