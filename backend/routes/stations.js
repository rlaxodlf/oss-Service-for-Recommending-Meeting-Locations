// GET /stations : 출발역 검색용 역 목록 (일반 모드)

const express = require("express");
const { stations } = require("../data/stations.json");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        stations: stations
            .map(s => ({ id: s.id, name: s.name, lines: s.lines, hot: s.hot }))
            .sort((a, b) => a.name.localeCompare(b.name))
    });
});

module.exports = router;
