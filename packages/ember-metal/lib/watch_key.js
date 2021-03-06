import isEnabled from './features';
import {
  meta as metaFor
} from './meta';
import {
  MANDATORY_SETTER_FUNCTION,
  DEFAULT_GETTER_FUNCTION,
  INHERITING_GETTER_FUNCTION
} from './properties';
import { lookupDescriptor } from './utils';

let handleMandatorySetter;

export function watchKey(obj, keyName, meta) {
  let m = meta || metaFor(obj);

  // activate watching first time
  if (!m.peekWatching(keyName)) {
    m.writeWatching(keyName, 1);

    let possibleDesc = obj[keyName];
    let desc = (possibleDesc !== null &&
                typeof possibleDesc === 'object' &&
                possibleDesc.isDescriptor) ? possibleDesc : undefined;
    if (desc && desc.willWatch) { desc.willWatch(obj, keyName); }

    if ('function' === typeof obj.willWatchProperty) {
      obj.willWatchProperty(keyName);
    }

    if (isEnabled('mandatory-setter')) {
      // NOTE: this is dropped for prod + minified builds
      handleMandatorySetter(m, obj, keyName);
    }
  } else {
    m.writeWatching(keyName, (m.peekWatching(keyName) || 0) + 1);
  }
}


if (isEnabled('mandatory-setter')) {
  let hasOwnProperty = function(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  };

  let propertyIsEnumerable = function(obj, key) {
    return Object.prototype.propertyIsEnumerable.call(obj, key);
  };

  // Future traveler, although this code looks scary. It merely exists in
  // development to aid in development asertions. Production builds of
  // ember strip this entire block out
  handleMandatorySetter = function handleMandatorySetter(m, obj, keyName) {
    let descriptor = lookupDescriptor(obj, keyName);
    let configurable = descriptor ? descriptor.configurable : true;
    let isWritable = descriptor ? descriptor.writable : true;
    let hasValue = descriptor ? 'value' in descriptor : true;
    let possibleDesc = descriptor && descriptor.value;
    let isDescriptor = possibleDesc !== null &&
                       typeof possibleDesc === 'object' &&
                       possibleDesc.isDescriptor;

    if (isDescriptor) { return; }

    // this x in Y deopts, so keeping it in this function is better;
    if (configurable && isWritable && hasValue && keyName in obj) {
      let desc = {
        configurable: true,
        set: MANDATORY_SETTER_FUNCTION(keyName),
        enumerable: propertyIsEnumerable(obj, keyName),
        get: undefined
      };

      if (hasOwnProperty(obj, keyName)) {
        m.writeValues(keyName, obj[keyName]);
        desc.get = DEFAULT_GETTER_FUNCTION(keyName);
      } else {
        desc.get = INHERITING_GETTER_FUNCTION(keyName);
      }

      Object.defineProperty(obj, keyName, desc);
    }
  };
}

import { UNDEFINED } from './meta';

export function unwatchKey(obj, keyName, meta) {
  let m = meta || metaFor(obj);
  let count = m.peekWatching(keyName);
  if (count === 1) {
    m.writeWatching(keyName, 0);

    let possibleDesc = obj[keyName];
    let desc = (possibleDesc !== null &&
                typeof possibleDesc === 'object' &&
                possibleDesc.isDescriptor) ? possibleDesc : undefined;

    if (desc && desc.didUnwatch) { desc.didUnwatch(obj, keyName); }

    if ('function' === typeof obj.didUnwatchProperty) {
      obj.didUnwatchProperty(keyName);
    }

    if (isEnabled('mandatory-setter')) {
      // It is true, the following code looks quite WAT. But have no fear, It
      // exists purely to improve development ergonomics and is removed from
      // ember.min.js and ember.prod.js builds.
      //
      // Some further context: Once a property is watched by ember, bypassing `set`
      // for mutation, will bypass observation. This code exists to assert when
      // that occurs, and attempt to provide more helpful feedback. The alternative
      // is tricky to debug partially observable properties.
      if (!desc && keyName in obj) {
        let maybeMandatoryDescriptor = lookupDescriptor(obj, keyName);

        if (maybeMandatoryDescriptor.set && maybeMandatoryDescriptor.set.isMandatorySetter) {
          if (maybeMandatoryDescriptor.get && maybeMandatoryDescriptor.get.isInheritingGetter) {
            let possibleValue = m.readInheritedValue('values', keyName);
            if (possibleValue === UNDEFINED) {
              delete obj[keyName];
              return;
            }
          }

          Object.defineProperty(obj, keyName, {
            configurable: true,
            enumerable: Object.prototype.propertyIsEnumerable.call(obj, keyName),
            writable: true,
            value: m.peekValues(keyName)
          });
          m.deleteFromValues(keyName);
        }
      }
    }
  } else if (count > 1) {
    m.writeWatching(keyName, count - 1);
  }
}
