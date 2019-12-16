import encodeOpaqueId from "@reactioncommerce/api-utils/encodeOpaqueId.js";
import importAsString from "@reactioncommerce/api-utils/importAsString.js";
import Factory from "/tests/util/factory.js";
import TestApp from "/tests/util/TestApp.js";

const RemoveUserPermissionsMutation = importAsString("./removeUserPermissionsMutation.graphql");

jest.setTimeout(300000);

let removeUserPermissions;
let customerGroup;
let mockAdminAccount;
let mockOtherAccount;
let shopId;
let shopManagerGroup;
let shopOpaqueId;
let testApp;
const shopManagerGroupName = "shop manager";
beforeAll(async () => {
  testApp = new TestApp();
  await testApp.start();
  shopId = await testApp.insertPrimaryShop();

  mockAdminAccount = Factory.Account.makeOne({
    _id: "mockAdminAccount",
    roles: {
      [shopId]: ["reaction-accounts"]
    },
    groups: [shopManagerGroupName],
    shopId
  });
  await testApp.createUserAndAccount(mockAdminAccount);

  mockOtherAccount = Factory.Account.makeOne({
    _id: "mockOtherAccount",
    groups: [],
    roles: {},
    shopId
  });
  await testApp.createUserAndAccount(mockOtherAccount);

  shopManagerGroup = Factory.Group.makeOne({
    createdBy: null,
    name: shopManagerGroupName,
    permissions: ["admin", "shopManagerGroupPermission"],
    slug: shopManagerGroupName,
    shopId
  });
  await testApp.collections.Groups.insertOne(shopManagerGroup);

  customerGroup = Factory.Group.makeOne({
    createdBy: null,
    name: "customer",
    permissions: ["customerGroupPermission"],
    slug: "customer",
    shopId
  });
  await testApp.collections.Groups.insertOne(customerGroup);

  shopOpaqueId = encodeOpaqueId("reaction/shop", shopId);

  removeUserPermissions = testApp.mutate(RemoveUserPermissionsMutation);
});

afterAll(async () => {
  testApp.collections.Accounts.deleteMany({});
  testApp.collections.Shops.deleteMany({});
  testApp.collections.users.deleteMany({});
  testApp.collections.Groups.deleteMany({});
  await testApp.stop();
});

beforeEach(async () => {
  await testApp.collections.Accounts.updateOne({ _id: mockOtherAccount._id }, {
    $set: {
      groups: []
    }
  });

  await testApp.collections.users.updateOne({ _id: mockOtherAccount._id }, {
    $set: {
      roles: {}
    }
  });
});

test("anyone can with the required permissions can remove a group(s) to an account", async () => {
  await testApp.setLoggedInUser(mockAdminAccount);

  const groupName = "test-group-1";
  // The group that is to be removed from the  account
  const testGroup1 = Factory.Group.makeOne({
    createdBy: null,
    name: groupName,
    permissions: ["test-group-1-permission"],
    slug: groupName,
    shopId
  });
  await testApp.collections.Groups.insertOne(testGroup1);
  const updatedAccountBeforeGroupRemoval = await testApp.collections.Accounts.findOneAndUpdate(
    {
      _id: mockAdminAccount._id
    }, {
      $addToSet: {
        groups: {
          $each: [groupName]
        }
      }
    },
    { returnOriginal: false }
  );


  await removeUserPermissions({ groups: ["test-group-1"], shopId: shopOpaqueId });
  const dbResult = await testApp.collections.Accounts.findOne({ _id: mockAdminAccount._id });

  expect(updatedAccountBeforeGroupRemoval.value.groups.length).toEqual(2);
  expect(updatedAccountBeforeGroupRemoval.value.groups).toEqual(expect.arrayContaining(["test-group-1"]));
  expect(dbResult.groups).toEqual(expect.not.arrayContaining(["test-group-1"]));
  expect(dbResult.groups.length).toBe(1);
});


test("anyone without the required permissions should be denied access to remove group from an account", async () => {
  await testApp.setLoggedInUser(mockOtherAccount);

  const groupName = "test-group-1";
  // The group that is to be added tp th  account
  const testGroup1 = Factory.Group.makeOne({
    createdBy: null,
    name: groupName,
    permissions: ["test-group-1-permission"],
    slug: groupName,
    shopId
  });
  await testApp.collections.Groups.insertOne(testGroup1);
  await testApp.collections.Accounts.findOneAndUpdate(
    {
      _id: mockAdminAccount._id
    }, {
      $addToSet: {
        groups: {
          $each: [groupName]
        }
      }
    },
    { returnOriginal: false }
  );

  let err = null;
  try {
    await removeUserPermissions({ groups: ["test-group-1"], shopId: shopOpaqueId });
  } catch (errors) {
    err = errors;
  }
  expect(err).toBeTruthy();
  expect(err[0]).toMatchSnapshot();
});

