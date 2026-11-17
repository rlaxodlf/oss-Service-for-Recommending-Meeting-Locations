
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const roomsRouter = require("./routes/rooms");
const schedulesRouter = require("./routes/schedules");
const slotsRouter = require("./routes/slots");
const meetupsRouter = require("./routes/meetups");
const stationsRouter = require("./routes/stations");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/rooms", roomsRouter);
app.use("/rooms", schedulesRouter);
app.use("/rooms", slotsRouter);

// 일반 모드(친구 약속) API
app.use("/meetups", meetupsRouter);
app.use("/stations", stationsRouter);

app.get("/", (req, res) => {
    res.json({
        message: "Meeting Recommendation API",
        status: "running"
    });
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// 방 관리 API 연결
app.use("/rooms", roomsRouter);
app.use("/rooms", schedulesRouter);

// 서버 오류 처리
app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        error: "서버 내부 오류가 발생했습니다."
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
