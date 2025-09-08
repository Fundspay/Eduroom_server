const toOriginal = require("await-to-js").to;
const pe = require("parse-error");

// Async/Await error handling wrapper
module.exports.to = async (promise) => {
    const [err, res] = await toOriginal(promise);
    if (err) return [pe(err), null];
    return [null, res];
};

// Error Web Response
module.exports.ReE = (res, err, code = 422) => {
    let errorMessage = err;
    if (typeof err === "object" && err.message) {
        errorMessage = err.message;
    }
    return res.status(code).json({ success: false, error: errorMessage });
};

// ✅ Success Web Response (fixed circular structure issue)
module.exports.ReS = (res, data, code = 200) => {
    let safeData;
    try {
        // This removes Sequelize circular refs like `parent` and `include`
        safeData = JSON.parse(JSON.stringify(data));
    } catch (e) {
        safeData = data; // fallback in case JSON conversion fails
    }

    return res.status(code).json({ success: true, data: safeData });
};

// Throw Error Utility (TE stands for Throw Error)
module.exports.TE = (err_message, log = false) => {
    if (log) {
        console.error(err_message);
    }
    throw new Error(err_message);
};
