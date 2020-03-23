const logger = require('logger');
const { should } = require('chai');
const ogrRouterV2 = require('routes/api/v2/ogrRouter.router');
const path = require('path');
const fs = require('fs-extra');


const stat = (statPath) => (callback) => {
    fs.stat(statPath, callback);
};

const unlink = (file) => (callback) => {
    fs.unlink(file, callback);
};


describe('Check /convert route', () => {

    const ctxInvalid = {
        assert() {
            return false;
        },
        request: {
            body: {
                files: {
                    file: {
                        path: '/tmp/invalid/invalid.zip'
                    }
                }
            }
        },
        body: null,
        throw() { }
    };

    const ctxInvalidNotParam = {
        request: {
            body: {
                files: {}
            }
        },
        body: null,
        throw() { }
    };

    const url = '/ogr/convert';
    const method = 'POST';
    let func = null;

    before(() => {
        for (let i = 0, { length } = ogrRouterV2.stack; i < length; i++) {
            if (ogrRouterV2.stack[i].regexp.test(url) && ogrRouterV2.stack[i].methods.indexOf(method) >= 0) {
                // eslint-disable-next-line prefer-destructuring
                func = ogrRouterV2.stack[i].stack[1];
            }
        }

    });

    describe('Invalid files v2', () => {
        beforeEach(() => {
            logger.debug('Copying file');
            fs.copySync(path.join(__dirname, '../files/invalid.zip'), path.join('/tmp/invalid', 'invalid.zip'));
        });

        it('Convert invalid file', function* convertInvalidFile() {

            const funcTest = func.bind(ctxInvalid);
            funcTest.should.be.a.Function();
            let resultStat = null;
            try {
                yield funcTest();
                ctxInvalid.status.should.be.equal(400);

                resultStat = yield stat(ctxInvalid.request.body.files.file.path);

            } catch (e) {
                e.should.be.a.Error();
            }
            should(resultStat).be.null();

        });
        afterEach(function* afterConvertInvalidFile() {
            try {
                yield unlink(path.join('/tmp', 'invalid.zip'));
                // eslint-disable-next-line no-empty
            } catch (e) {

            }
        });
    });

    describe('Not file param v2', () => {
        it('Check file in body', function* checkFileInBody() {

            const funcTest = func.bind(ctxInvalidNotParam);
            funcTest.should.be.a.Function();
            const resultStat = null;
            try {
                yield funcTest();
                ctxInvalid.status.should.be.equal(400);
            } catch (e) {
                e.should.be.a.Error();
            }
            resultStat.should.be.null();
        });
    });
});
