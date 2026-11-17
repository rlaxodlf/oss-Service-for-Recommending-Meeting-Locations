// 수정 토큰 발급과 검증. 서버에는 토큰의 해시만 저장한다.

const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");

function issueEditToken() {
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    return { token, hash };
}

function verifyEditToken(token, storedHash) {
    if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/.test(token) ||
        typeof storedHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(storedHash)
    ) {
        return false;
    }

    const tokenHash = createHash("sha256").update(token).digest();
    return timingSafeEqual(tokenHash, Buffer.from(storedHash, "hex"));
}

module.exports = { issueEditToken, verifyEditToken };
