const logger = require('logger');
const { should } = require('chai');
const ogrRouter = require('routes/api/v1/ogrRouter.router');
const path = require('path');
const fs = require('fs-extra');


const stat = (statPath) => (callback) => {
    fs.stat(statPath, callback);
};

const unlink = (file) => (callback) => {
    fs.unlink(file, callback);
};


describe('Check /convert route', () => {

    const ctx = {
        assert() {
            return false;
        },
        request: {
            body: {
                files: {
                    file: {
                        path: '/tmp/valid/shape.zip'
                    }
                }
            }
        },
        body: null
    };
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
        throw() {
        }
    };

    const ctxInvalidNotParam = {
        assert(param, status, message) {
            if (!param) {
                // eslint-disable-next-line mocha/no-setup-in-describe
                this.throw(status, message);
                throw new Error();
            }
        },
        request: {
            body: {
                files: {}
            }
        },
        body: null,
        throw() {
        }
    };
    const url = '/ogr/convert';
    const method = 'POST';
    let func = null;

    before(() => {

        for (let i = 0, { length } = ogrRouter.stack; i < length; i++) {
            if (ogrRouter.stack[i].regexp.test(url) && ogrRouter.stack[i].methods.indexOf(method) >= 0) {
                // eslint-disable-next-line prefer-destructuring
                func = ogrRouter.stack[i].stack[1];
            }
        }

    });
    describe('valid files', () => {
        beforeEach(() => {
            logger.debug('Copying file');
            fs.copySync(path.join(__dirname, '../files/shape.zip'), path.join('/tmp/valid', 'shape.zip'));
        });


        it('Convert valid file', function* convertValidFile() {
            const funcTest = func.bind(ctx);
            funcTest.should.be.a.Function();
            yield funcTest();
            ctx.body.should.not.be.null();
            ctx.body.should.have.property('data');
            const { data } = ctx.body;
            data.should.have.property('type');
            data.should.have.property('attributes');
            data.should.have.property('id');
            data.type.should.equal('geoJSON');

            let resultStat = null;
            try {
                resultStat = yield stat(ctx.request.body.files.file.path);
                // if not return exception, fail
                true.should.be.equal(false);
            } catch (e) {
                e.should.be.a.Error();
            }
            should(resultStat).be.null();
        });

        afterEach(function* afterConvertValidFile() {
            try {
                yield unlink(path.join('/tmp', 'shape.zip'));
                // eslint-disable-next-line no-empty
            } catch (e) {
            }
        });
    });

    describe('Invalid files', () => {
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

    describe('Not file param', () => {
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
            should(resultStat).be.null();
        });
    });
});
