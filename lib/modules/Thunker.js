export default {
  create() {
    let storeQueue = [];  // DEPRECATED
    let actionQueue = [];
    let stateBecomesQueue = [];

    const waitForAction = (actionFn, cb=()=>{}) => new Promise((resolve, reject) => {
      actionQueue = actionQueue.concat([[actionFn, state => resolve(state)]]);
    }).then(cb);

    const stateBecomes = (successFn, failureFn) => {
      if (!successFn || !failureFn) {
        console.warning('Both success and failure functions required');
      }

      return new Promise((resolve, reject) => {
        // push the check state function onto the queue. To pass knowledge
        // that these have resolved in some form, we return a bool
        stateBecomesQueue.push(state => {
          if (successFn(state)) {
            resolve(state);
            return true;
          } else if (failureFn(state)) {
            reject(state);
            return true;
          }

          return false;
        });
      });
    };

    return store => next => action => {
      const { dispatch, getState } = store;

      const state = getState();

      // DEPRECATED
      const waitForState = (stateFn, cb=()=>{}, stateFailedFn=()=>{}) => new Promise((resolve, reject) => {
        if (!stateFn(state)) {
          storeQueue = storeQueue.concat([[stateFn, newState => resolve(newState)]]);
          stateFailedFn(state);
        } else {
          resolve(state);
        }
      }).then(cb);

      if (typeof action === 'function') {
        const result = action(dispatch, getState, { waitForState, waitForAction, stateBecomes });

        if (!(result instanceof Promise)) {
          throw new Error('Thunked actions must return promises');
        }

        return next(result);
      }

      actionQueue = actionQueue.filter(([actionFn, cb]) => {
        if (actionFn(action)) {
          cb(state);
          return false;
        }

        return true;
      });

      // order of operations is very important here.
      // for the store queue to process properly, we need to let the new action
      // make its way into the store first before we check if any queued
      // waitForState situations are resolveable
      next(action);

      // run the state checks, removing any resolutions
      stateBecomesQueue = stateBecomesQueue.filter(stateCheck => stateCheck(state));

      // DEPRECATED
      // also important, the store queue filter function must re-fetch state
      // using getState, otherwise the aforementioned action's effects will not
      // be reflected in the filter function.
      storeQueue = storeQueue.filter(([stateFn, cb]) => {
        const state = getState();
        if (stateFn(state)) {
          cb(state);
          return false;
        }

        return true;
      });


    };
  },
};
