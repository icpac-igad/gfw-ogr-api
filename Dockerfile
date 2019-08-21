FROM geodata/gdal:latest
MAINTAINER hello@vizzuality.com

# Install node
RUN apt-get update && apt-get -y install curl git
RUN curl -sL https://deb.nodesource.com/setup_7.x | bash -
RUN apt-get install -y nodejs

# end install node
RUN npm install -g grunt grunt-cli bunyan
ENV NAME gfw-ogr-api
ENV USER microservice

RUN groupadd -r $USER && useradd -r -g $USER $USER

RUN mkdir -p /opt/$NAME
ADD package.json /opt/$NAME/package.json
 RUN cd /opt/$NAME && npm install

COPY entrypoint.sh /opt/$NAME/entrypoint.sh
COPY config /opt/$NAME/config

WORKDIR /opt/$NAME

COPY ./app /opt/$NAME/app
RUN chown $USER:$USER /opt/$NAME

# Tell Docker we are going to use this ports
EXPOSE 3200
USER $USER

ENTRYPOINT ["./entrypoint.sh"]
