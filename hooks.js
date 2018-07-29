const opentracing = require('opentracing');
const { tagDefaults, mask } = require('./utils');

const opentracingBegin = (options = {}) => {
  return async hook => {
    options.tag = { ...tagDefaults, ...options.tag };

    const { path, method, id, data, params } = hook;
    const { rootSpan, firstEndpoint, query } = params;
    const tracer = opentracing.globalTracer();
    const span = firstEndpoint ? rootSpan : tracer.startSpan(path, { childOf: rootSpan });

    if (!hook.params.firstEndpoint) {
      span.log({ event: 'request_received' });
      span.setOperationName(path);
    }

    if (options.debug)
      span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);

    span.setTag('span.kind', 'service');
    span.setTag('service.method', method);

    if (options.tag.id && id)
      span.setTag('id', id);

    if (options.tag.data && data && Object.keys(data).length)
      span.setTag('data', options.mask ? mask(data, options.mask) : data);

    if (options.tag.query && query && Object.keys(query).length)
      span.setTag('query', options.mask ? mask(query, options.mask) : query);

    hook.params.span = span;

    return hook;
  };
};

const opentracingEnd = () => {
  return async hook => {
    const { span } = hook.params;

    if (!hook.params.firstEndpoint) {
      span.log({ event: 'request_finished' });
      span.finish();
    }

    return hook;
  };
};

const opentracingError = () => {
  return async hook => {
    const { span } = hook.params;
    const { code, message, stack } = hook.error;

    span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 1);
    span.setTag(opentracing.Tags.ERROR, true);
    span.setTag('error.code', code);
    span.setTag('error.stack', stack);

    if (!hook.params.firstEndpoint) {
      span.log({ event: 'request_error', message });
      span.finish();
    }

    return hook;
  };
};

module.exports = {
  opentracingBegin,
  opentracingEnd,
  opentracingError,
};
