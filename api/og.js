module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('og function works');
};
