import { strict as assert } from "node:assert";
import { answerQuestion } from "./media_qa_service.js";
try { await answerQuestion({ question: "", creatorId: "c1" }); assert.fail("empty question should be rejected"); } catch (error) { assert.match(String(error), /String must contain at least 1 character/); }
console.log("request boundary test passed");
