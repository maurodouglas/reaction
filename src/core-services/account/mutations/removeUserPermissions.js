import SimpleSchema from "simpl-schema";
import ReactionError from "@reactioncommerce/reaction-error";

const inputSchema = new SimpleSchema({
  "accountId": String,
  "groups": {
    type: Array, // groupIds that user belongs to
    optional: true,
    defaultValue: []
  },
  "groups.$": {
    type: String
  }
});

/**
 * @name accounts/removeUserPermissions
 * @memberof Mutations/Accounts
 * @summary Removes a group from an account (user) group. This addition to an account  group effectively
 * removes permissions from account (user)
 * @param {Object} context - GraphQL execution context
 * @param {Object} input - Necessary input for mutation. See SimpleSchema.
 * @param {Object} input.groups - groups to append to
 * @param {String} input.accountId - decoded ID of account on which entry should be updated
 * @returns {Promise<Object>} with updated account
 */
export default async function removeUserPermissions(context, input) {
  const itemsToValidate = { accountId: input.accountId, groups: input.groups };
  inputSchema.validate(itemsToValidate);
  const { appEvents, collections, userId: userIdFromContext } = context;
  const { Accounts } = collections;
  const { groups, shopId, accountId } = input;


  const account = await Accounts.findOne({ _id: accountId });

  if (!account) throw new ReactionError("not-found", "No account found");

  if (!context.isInternalCall) {
    await context.validatePermissions("reaction:accounts", "update", { shopId, legacyRoles: ["reaction-accounts"] });
  }


  // Update the Reaction Accounts collection with new groups info
  // This
  const { value: updatedAccount } = await Accounts.findOneAndUpdate(
    {
      _id: accountId
    },
    {
      $pull: {
        groups: {
          $in: groups
        }
      }
    }, {
      returnNewDocument: true
    }
  );

  if (!updatedAccount) {
    throw new ReactionError("server-error", "Unable to update account groups");
  }

  // Create an array which contains all fields that have changed
  // This is used for search, to determine if we need to re-index
  const updatedFields = ["groups"];

  await appEvents.emit("afterAccountUpdate", {
    account: updatedAccount,
    updatedBy: userIdFromContext,
    updatedFields
  });

  return updatedAccount;
}
