
const { calculateSlots } = require("./rules/slots");

const room = {
  minMinutes: 60,
  members: [
    {
      nickname: "민수",
      classes: [
        {
          day: "mon",
          start: "10:00",
          end: "12:00",
          building: "saebit"
        }
      ]
    },
    {
      nickname: "철수",
      classes: [
        {
          day: "mon",
          start: "13:00",
          end: "15:00",
          building: "bima"
        }
      ]
    }
  ]
};

const slots = calculateSlots(room);

console.log(JSON.stringify(slots, null, 2));
