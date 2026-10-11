import { GameError, withTx, type Tx } from "./db";
import * as game from "./game";
import * as careers from "./careers";
import * as minigames from "./minigames";
import * as stories from "./stories";
import * as goals from "./goals";
import * as economy from "./economy";
import * as courses from "./courses";
import * as wardrobe from "./wardrobe";
import * as health from "./health";
import * as household from "./household";
import * as social from "./social";
import * as market from "./market";
import * as company from "./company";
import * as playerJobs from "./playerJobs";
import * as tables from "./tables";
import * as civic from "./civic";
import * as late from "./lateGame";
import * as venuesA from "./venues_a";
import * as family from "./family";
import * as property from "./property";

type Handler = (tx: Tx, accountId: string, payload: never, now: Date) => Promise<{ message: string } | { created: boolean }>;

const HANDLERS: Record<string, Handler> = {
  CreateCharacter: game.createCharacter as Handler,
  StartActivity: game.startActivity as Handler,
  CancelActivity: ((tx, a, _p, now) => game.cancelActivity(tx, a, now)) as Handler,
  StartJourney: game.startJourney as Handler,
  CancelJourney: ((tx, a, _p, now) => game.cancelJourney(tx, a, now)) as Handler,
  BuyGroceries: game.buyGroceries as Handler,
  BuyFurniture: game.buyFurniture as Handler,
  PlaceFurniture: game.placeFurniture as Handler,
  StoreFurniture: game.storeFurniture as Handler,
  SellFurniture: game.sellFurniture as Handler,
  ClaimMission: game.claimMission as Handler,
  SwapMission: game.swapDailyMission as Handler,
  JoinCareer: careers.joinCareer as Handler,
  StartShift: careers.startShift as Handler,
  SetWorkStyle: careers.setWorkStyle as Handler,
  SubmitWorkTask: careers.submitWorkTask as Handler,
  LeaveShift: careers.leaveShift as Handler,
  BeginMinigame: minigames.beginMinigame as Handler,
  SubmitMinigame: minigames.submitMinigame as Handler,
  StartStory: stories.startStory as Handler,
  ChooseStory: stories.chooseStory as Handler,
  LeaveStory: stories.leaveStory as Handler,
  ClaimTreasure: stories.claimTreasure as Handler,
  DailyCheckIn: goals.dailyCheckIn as Handler,
  ClaimWish: goals.claimWish as Handler,
  BuyPerk: goals.buyPerk as Handler,
  ClaimAmbition: goals.claimAmbition as Handler,
  ChangeAmbition: goals.changeAmbition as Handler,
  DepositSavings: economy.depositSavings as Handler,
  WithdrawSavings: economy.withdrawSavings as Handler,
  PayBills: economy.payBills as Handler,
  MoveHome: economy.moveHome as Handler,
  BuyHome: economy.buyHome as Handler,
  SubmitLessonQuiz: courses.submitLessonQuiz as Handler,
  BuyGarment: wardrobe.buyGarment as Handler,
  EquipOutfit: wardrobe.equipOutfit as Handler,
  ChangeHair: wardrobe.changeHair as Handler,
  OrderDelivery: health.orderDelivery as Handler,
  HireStaff: household.hireStaff as Handler,
  FireStaff: household.fireStaff as Handler,
  CollectChefMeal: household.collectChefMeal as Handler,
  SendFriendRequest: social.sendFriendRequest as Handler,
  RespondFriendRequest: social.respondFriendRequest as Handler,
  WithdrawFriendRequest: social.withdrawFriendRequest as Handler,
  Unfriend: social.unfriend as Handler,
  BlockPlayer: social.blockPlayer as Handler,
  UnblockPlayer: social.unblockPlayer as Handler,
  SendMessage: social.sendMessage as Handler,
  SendGift: social.sendGift as Handler,
  RequestMoney: social.requestMoney as Handler,
  RespondMoneyRequest: social.respondMoneyRequest as Handler,
  CancelMoneyRequest: social.cancelMoneyRequest as Handler,
  VisitHome: social.visitHome as Handler,
  LeaveVisit: social.leaveVisit as Handler,
  UpdateSocialSettings: social.updateSocialSettings as Handler,
  ReportPlayer: social.reportPlayer as Handler,
  ListItem: market.listItem as Handler,
  CancelListing: market.cancelListing as Handler,
  BuyListing: market.buyListing as Handler,
  FoundCompany: company.foundCompany as Handler,
  PostJob: playerJobs.postJob as Handler,
  ApplyJob: playerJobs.applyJob as Handler,
  HireApplicant: playerJobs.hireApplicant as Handler,
  DeclineApplicant: playerJobs.declineApplicant as Handler,
  WithdrawJob: playerJobs.withdrawJob as Handler,
  SubmitJob: playerJobs.submitJob as Handler,
  CompleteJob: playerJobs.completeJob as Handler,
  CancelJob: playerJobs.cancelJob as Handler,
  CreateGameTable: tables.createGameTable as Handler,
  JoinGameTable: tables.joinGameTable as Handler,
  GameMove: tables.gameMove as Handler,
  LeaveGameTable: tables.leaveGameTable as Handler,
  Rematch: tables.rematch as Handler,
  StandForElection: civic.standForElection as Handler,
  CastVote: civic.castVote as Handler,
  BuyVehicle: late.buyVehicle as Handler,
  SellVehicle: late.sellVehicle as Handler,
  ServiceVehicle: late.serviceVehicle as Handler,
  PayVehicleUpkeep: late.payVehicleUpkeep as Handler,
  BuyInsurance: late.buyInsurance as Handler,
  CancelInsurance: late.cancelInsurance as Handler,
  ClaimInsurance: late.claimInsurance as Handler,
  AdoptPet: late.adoptPet as Handler,
  CarePet: late.carePet as Handler,
  RehomePet: late.rehomePet as Handler,
  BuyArtwork: venuesA.buyArtwork as Handler,
  AskToDate: family.askToDate as Handler,
  ProposePartnership: family.proposePartnership as Handler,
  RespondRomance: family.respondRomance as Handler,
  WithdrawRomance: family.withdrawRomance as Handler,
  EndRelationship: family.endRelationship as Handler,
  InviteToVisit: family.inviteToVisit as Handler,
  InviteToHousehold: family.inviteToHousehold as Handler,
  RespondInvitation: family.respondInvitation as Handler,
  RevokeInvitation: family.revokeInvitation as Handler,
  LeaveHousehold: family.leaveHousehold as Handler,
  RemoveHouseholdMember: family.removeHouseholdMember as Handler,
  UseHostHome: family.useHostHome as Handler,
  OpenParty: family.openParty as Handler,
  InviteToParty: family.inviteToParty as Handler,
  JoinParty: family.joinParty as Handler,
  EndParty: family.endParty as Handler,
  EndGuestVisit: family.endGuestVisit as Handler,
  BuyInvestment: property.buyInvestment as Handler,
  SellInvestment: property.sellInvestment as Handler,
  BuyPlot: property.buyPlot as Handler,
  SellPlot: property.sellPlot as Handler,
  StartConstruction: property.startConstruction as Handler,
  CancelConstruction: property.cancelConstruction as Handler,
};

export interface CommandResult {
  ok: true;
  receipt: unknown;
  replayed: boolean;
}

/**
 * Runs one mutating command in a single transaction.
 * The idempotency row is inserted first: a concurrent duplicate blocks on it, then replays the stored receipt.
 * A rejected command rolls back entirely (including the idempotency row), so nothing is partially debited.
 */
export async function runCommand(accountId: string, key: string, type: string, payload: unknown, now = new Date()): Promise<CommandResult> {
  if (typeof key !== "string" || key.length < 8 || key.length > 100) throw new GameError("bad_key", "Missing idempotency key.");
  const handler = HANDLERS[type];
  if (!handler) throw new GameError("unknown_command", `Unknown command ${type}.`);
  return withTx(async (tx) => {
    const claim = await tx.query(
      "INSERT INTO idempotency_keys (account_id, key, command, response) VALUES ($1, $2, $3, '{}') ON CONFLICT DO NOTHING",
      [accountId, key, type],
    );
    if (!claim.rowCount) {
      const prior = await tx.query("SELECT command, response FROM idempotency_keys WHERE account_id = $1 AND key = $2", [accountId, key]);
      if (prior.rows[0].command !== type) throw new GameError("key_reused", "That request key was already used for a different action.");
      return { ok: true, receipt: prior.rows[0].response, replayed: true };
    }
    const receipt = await handler(tx, accountId, (payload ?? {}) as never, now);
    await tx.query("UPDATE idempotency_keys SET response = $3 WHERE account_id = $1 AND key = $2", [accountId, key, receipt]);
    return { ok: true, receipt, replayed: false };
  });
}

export function loadStateFor(accountId: string, now = new Date()) {
  return withTx((tx) => game.loadState(tx, accountId, now));
}

/** Read-only social queries for the phone (search, profiles, threads, rankings, feed, light poll). */
export function socialQueryFor(accountId: string, op: string, params: Record<string, unknown>, now = new Date()) {
  return withTx((tx) => social.socialQuery(tx, accountId, op, params, now));
}

export function loadTableFor(accountId: string, tableId: unknown, now = new Date()) {
  return withTx((tx) => tables.loadTableFor(tx, accountId, tableId, now));
}
