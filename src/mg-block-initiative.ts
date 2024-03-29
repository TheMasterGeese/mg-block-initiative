/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// Register Game Settings
Hooks.once("init", function () {
    game.settings.register("mg-block-initiative", "InitiativeHandicap", {
        name: game.i18n.localize("BLOCKINITIATIVE.SettingsInitiativeHandicapTitle"),
        hint: game.i18n.localize("BLOCKINITIATIVE.SettingsInitiativeHandicapHint"),
        scope: "world",
        config: true,
        default: "-3",
        type: String
    });
});

Hooks.once("ready", () => {
    // TODO: Edit the setting on mg-ready-check that enables all players to initiate ready checks. Enable it, and add a warning to the setting hint
    // noting that if that setting is disabled, block-initiative may not send notifications properly if a GM isn't logged on.
    if (socket) {
        // create the socket handler
        socket.on('module.mg-block-initiative', (actionId: string, combatantId: string) => {
            
            switch (actionId) {
                // TODO: Refactor this listener to handle both the reaction button it already was, plus handling disabling/enabling reaction buttons when the phase changes.
                case "notifyReaction":
                    sendReadyCheck(combatantId, game.i18n.localize("BLOCKINITIATIVE.HasReacted"), true);
                    break;
                case "notifyInvalidAction":
                    sendReadyCheck(combatantId, game.i18n.localize("BLOCKINITIATIVE.InvalidAction"), false);
                    break;
                case "notifyConfirmAction":
                    sendReadyCheck(combatantId, game.i18n.localize("BLOCKINITIATIVE.ConfirmAction"), false);
                    break;
                case "changePhase":
                    enableDisableReactionButtons(game.combat.getFlag("mg-block-initiative", "currentPhase") as string);
                    break;     
            }    
        });
    }
});

Hooks.on("createCombat", async function (combat: Combat, _options: any, _userId: string) {
    await combat.setFlag('mg-block-initiative', 'currentPhase', game.i18n.localize("BLOCKINITIATIVE.EnemiesAct"));
});

Hooks.on("renderCombatTracker", function (app: Application, html: JQuery, data: object) {

    // Exit if there is no combat
    if (!game.combat) return;

    // render changes to the encounter tracker
    // Implement combat groups in a similar manner to how they are implemented in the combat groups mod.
    createCombatantGroups();

    // Add the Combat phase UI element
    // Is displayed above all the combatants, but below the row containing the round counter, button to roll initiative, reset initiative, etc.
    // consists of 4 sections, displayed horizontally in this order: Enemies Act, Players React, Players Act, Enemies React
    // The Current phase is displayed differently than the Others
    createPhaseTracker();

    // Add "Sort Into Blocks" button
    if (game.user.role === 4) { // Render for GM
        createSortIntoBlocksButton();
    }

    // Add "Reaction" buttons
    createCombatantButtons();

    overrideCombatControls();


    // For players, only render the reaction button for combatants they control
    // For GM, only render the reaction button for NPCs.

    // For players, this affects either the currently selected token or defaults to their character
    // For GMs, this affects the currently selected token
    // Starts ready check targeting all players with a token in the current scene
    // Says "X has reacted"
    // Add "Confirm Action" button
    // Render for GM
    // Affects the token the GM has selected
    // Starts ready check targeting the player that controls that token
    // Says "<Player> confirm action for <Token>"
    // Add "Invalid Action" button
    // Render for GM
    // Affects the token the GM has selected
    // Starts ready check targeting the player that controls that token
    // Says "<Player> re-select action for <Token>"
    // Override how the "Next turn" buttons work
    // Instead of changing the turn to the next combatant, it changes the phase to the next phase.
    // Instead of changing the turn to the previous combatant, it changes the phase to the previous phase.    
});

// If an enemy ends their turn and they are not behind all players, they should be moved so that they are behind all players.
Hooks.on("pf2e.endTurn", async function (combatant: Combatant, encounter: Combat) {
    const initiative: MinMaxInitiative = getMinMaxPlayerInitiative(encounter);

    if (combatant.isNPC && combatant.initiative >= initiative.playerInitMax) {
        await encounter.setFlag('mg-ready-check', 'overrideNextTurn', true).then((result) => {
            return result.setInitiative(combatant.id, initiative.playerInitMin - 1)
        })
    }
});

// listens for flag to override the next turn.
Hooks.on("pf2e.startTurn", async function (combatant: Combatant, encounter: Combat) {
    if (encounter.getFlag('mg-ready-check', 'overrideNextTurn')) {
        encounter.data.turn = 0;
        encounter = await encounter.unsetFlag('mg-ready-check', 'overrideNextTurn');
    }
});

Hooks.on("changePhase", function (newPhase: string) {
    switch (newPhase) {
        case game.i18n.localize("BLOCKINITIATIVE.PlayersReact").replace('\n', ''):
            changeToPlayersReact();
            break;
        case game.i18n.localize("BLOCKINITIATIVE.PlayersAct").replace('\n', ''):
            changeToPlayersAct();
            break;
        case game.i18n.localize("BLOCKINITIATIVE.EnemiesReact").replace('\n', ''):
            changeToEnemiesReact();
            break;
        case game.i18n.localize("BLOCKINITIATIVE.EnemiesAct").replace('\n', ''):
            changeToEnemiesAct();
            break;
    }
});

function sendReadyCheck(combatantId : string, message : string, excludeCombatantOwner : boolean) {
    if (game.userId === game.settings.get("mg-living-world-core", "GMProxy")) {
        const combatant = game.combat.combatants.filter(c => c.id === combatantId)[0];
        const reactionMessage = combatant.name + message;
        let usersToMessage = getUsersInCombat();
        // We don't need to include ourself in this ready check
        const userFilter = excludeCombatantOwner ? (user : User) => {
            !user.isGM && !combatant.testUserPermission(user, "OWNER")
        }
        :
        (user : User) => {
           !user.isGM
        }
        usersToMessage = usersToMessage.filter(userFilter);

        Hooks.callAll("initReadyCheck", reactionMessage, usersToMessage);
    }
}
function setEncounterStartPhase() {
    const handler = async () => {
        await game.combat.setFlag('mg-block-initiative', 'currentPhase', game.i18n.localize("BLOCKINITIATIVE.EnemiesAct"));
    };

    void handler();
}

function createCombatantGroups() {
    // Remove any existing groups
    document.querySelectorAll("mg-combat-group li.combatant").forEach(combatant => document.querySelector("#combat-tracker")?.append(combatant));
    document.querySelectorAll("mg-combat-group").forEach(toggle => toggle.remove());

    // If there's any enemies that beat ALL the PCs in initiative
    // Create an enemies group that goes before PCs.

    // Create Players Group
    // Create Enemies Group

    // Get groups
    const groups = addUsersToGroups();

    // Go through each of the groups
    groups?.forEach((group, index) => {
        /** Toggle element */
        const toggle = document.createElement("details");
        toggle.classList.add("folder");
        toggle.open = true;

        /** A subdirectory in the toggle which contains Combatants */
        const subdirectory = document.createElement("ol");
        subdirectory.classList.add("subdirectory");
        toggle.append(subdirectory);

        // Go through each of the combatants
        group.forEach((combatant, i, arr) => {
            /** The DOM element of this combatant */
            const element = document.querySelector(`[data-combatant-id="${combatant.id}"]`);

            // If it's the last entry
            if (i === arr.length - 1) {
                // Add the toggle to the end
                document.querySelector("#combat-tracker").prepend(toggle);

                // Create a label for the toggle
                const labelBox = document.createElement("summary");
                labelBox.classList.add("mg-labelBox");
                labelBox.classList.add("folder-header");
                labelBox.innerText = i === 1 ? "Players" : "Enemies";
                // Insert the label box
                toggle.prepend(labelBox);

            }

            // Move the element into the subdirectory
            subdirectory.append(element);
        });
    });
}

function addUsersToGroups(): Combatant[][] {

    const combatantList = game.combat.combatants.contents;

    const findFastEnemies = (combatant: Combatant): boolean => {
        const playerMaxInit = getMinMaxPlayerInitiative(game.combat).playerInitMax
        return combatant.isNPC && combatant.initiative && combatant.initiative >= playerMaxInit
    }
    const fastEnemiesGroup: Combatant[] = buildCombatantGroup(combatantList, findFastEnemies)

    const findPlayers = (combatant: Combatant): boolean => {
        return !combatant.isNPC;
    }
    const playersGroup: Combatant[] = buildCombatantGroup(combatantList, findPlayers)
    const findEnemies = (combatant: Combatant): boolean => {
        const playerMaxInit = getMinMaxPlayerInitiative(game.combat).playerInitMax
        return combatant.isNPC && combatant.initiative && combatant.initiative < playerMaxInit
    }
    const enemiesGroup: Combatant[] = buildCombatantGroup(combatantList, findEnemies)

    let combatantGroups: Combatant[][] = [fastEnemiesGroup, playersGroup, enemiesGroup];

    combatantGroups = combatantGroups
        .map(group => group.sort(sortCombatants)) // Sort each group
        .sort((a, b) => sortCombatants(b[0], a[0])); // Sort by the first combatant

    return combatantGroups;
}

function buildCombatantGroup(combatantList: Combatant[], predicate: (combatant: Combatant) => boolean): Combatant[] {
    const combatantsInGroup: Combatant[] = [];
    combatantList.forEach(combatant => {
        if (predicate(combatant)) {
            combatantsInGroup.push(combatant);
        }
    })
    return combatantsInGroup;
}

function sortCombatants(a: Combatant, b: Combatant): number {
    if (a && b) {
        if (a.initiative && b.initiative) {
            return a.initiative < b.initiative ? 1 : -1;
        } else if (a.id && b.id) {
            return a.id < b.id ? 1 : -1
        } else {
            return -1
        }
    } else {
        return -1
    }
}

/**
 * Creates the phase tracker UI element in the Combat Manager.
 */
function createPhaseTracker() {

    const currentPhase = game.combat.getFlag('mg-block-initiative', 'currentPhase');

    const phaseTracker = document.createElement("nav");
    document.querySelector("#combat-tracker").before(phaseTracker);
    phaseTracker.id = "mg-phase-tracker"
    phaseTracker.classList.add("directory-header");

    const phaseTrackerButtons = document.createElement("nav");
    document.querySelector("#mg-phase-tracker").append(phaseTrackerButtons);
    phaseTrackerButtons.classList.add("flexrow", "mg-phase-buttons");

    createPhase(COMBATANT_SIDE.ENEMIES, game.i18n.localize("BLOCKINITIATIVE.EnemiesAct") as string);
    createPhase(COMBATANT_SIDE.PLAYERS, game.i18n.localize("BLOCKINITIATIVE.PlayersReact") as string);
    createPhase(COMBATANT_SIDE.PLAYERS, game.i18n.localize("BLOCKINITIATIVE.PlayersAct") as string);
    createPhase(COMBATANT_SIDE.ENEMIES, game.i18n.localize("BLOCKINITIATIVE.EnemiesReact") as string);

    /**
     * Helper function to create each of the block initiaitve phases
     * @param side The side that acts during this phase, either enemies or players.
     * @param phaseName The text to display as a label for this phase.
     */
    function createPhase(side: COMBATANT_SIDE, phaseName: string) {
        const phase = document.createElement("div");
        document.querySelector(".mg-phase-buttons").append(phase);
        phase.classList.add(side, "mg-phase-button");
        if (phaseName != currentPhase) {
            phase.classList.add("inactive", "mg-phase-button");
        }
        phase.innerText = phaseName;
    }
}

enum COMBATANT_SIDE {
    ENEMIES = "enemies",
    PLAYERS = "players"
}

function overrideCombatControls() {
    const combatControls = document.querySelector("#combat-controls");

    const nextTurnButton = combatControls.querySelector(`a[data-control="nextTurn"]`);
    jQuery(nextTurnButton).off('click').on('click', () => {
        const nextPhase = getNextPhase();
        void changePhase(nextPhase);
    });
    const previousTurnButton = combatControls.querySelector(`a[data-control="previousTurn"]`);
    jQuery(previousTurnButton).off('click').on('click', () => {
        const previousPhase = getPreviousPhase();
        void changePhase(previousPhase);
    });
}

function getNextPhase(): string {
    const currentPhase = document.querySelector('#mg-phase-tracker > nav > div:not(.inactive)').textContent;
    let nextPhase;
    switch (currentPhase) {
        case game.i18n.localize("BLOCKINITIATIVE.EnemiesAct").replace('\n', ''):
            nextPhase = game.i18n.localize("BLOCKINITIATIVE.PlayersReact").replace('\n', '');
            return nextPhase;
        case game.i18n.localize("BLOCKINITIATIVE.PlayersReact").replace('\n', ''):
            nextPhase = game.i18n.localize("BLOCKINITIATIVE.PlayersAct").replace('\n', '');
            return nextPhase;
        case game.i18n.localize("BLOCKINITIATIVE.PlayersAct").replace('\n', ''):
            nextPhase = game.i18n.localize("BLOCKINITIATIVE.EnemiesReact").replace('\n', '');
            return nextPhase;
        case game.i18n.localize("BLOCKINITIATIVE.EnemiesReact").replace('\n', ''):
            nextPhase = game.i18n.localize("BLOCKINITIATIVE.EnemiesAct").replace('\n', '');
            return nextPhase;
        default:
            return "";
    }
}

function getPreviousPhase(): string {
    const currentPhase = document.querySelector('#mg-phase-tracker > nav > div:not(.inactive)').textContent;
    switch (currentPhase) {
        case game.i18n.localize("BLOCKINITIATIVE.EnemiesAct").replace('\n', ''):
            return game.i18n.localize("BLOCKINITIATIVE.EnemiesReact").replace('\n', '');
        case game.i18n.localize("BLOCKINITIATIVE.PlayersReact").replace('\n', ''):
            return game.i18n.localize("BLOCKINITIATIVE.EnemiesAct").replace('\n', '');
        case game.i18n.localize("BLOCKINITIATIVE.PlayersAct").replace('\n', ''):
            return game.i18n.localize("BLOCKINITIATIVE.PlayersReact").replace('\n', '');
        case game.i18n.localize("BLOCKINITIATIVE.EnemiesReact").replace('\n', ''):
            return game.i18n.localize("BLOCKINITIATIVE.PlayersAct").replace('\n', '');
        default:
            return "";
    }
}

/**
 * Represents the two "sides" in combat.
 * 
 * "players" are all combatants controlled by PCs.
 * "enemies" are all other combatants, even if they are actually allies of the PCs/fighting on their behalf.
 */

/**
 * Changes the current combat phase,
 */
async function changePhase(newPhase?: string, changeRound?: boolean) {

    const playersReactButton = document.querySelector(`#mg-phase-tracker > nav > div:nth-child(1)`);
    const playersActButton = document.querySelector(`#mg-phase-tracker > nav > div:nth-child(2)`);
    const enemiesReactButton = document.querySelector(`#mg-phase-tracker > nav > div:nth-child(3)`);
    const enemiesActButton = document.querySelector(`#mg-phase-tracker > nav > div:nth-child(4)`);

    [playersReactButton, playersActButton, enemiesReactButton, enemiesActButton].forEach(button => {
        if (newPhase === button.textContent) {
            button.classList.remove('inactive');
        } else {
            button.classList.add('inactive');
        }
    })

    switch (newPhase) {
        case game.i18n.localize("BLOCKINITIATIVE.PlayersReact").replace('\n', ''):
            await game.combat.setFlag("mg-block-initiative", "currentPhase", game.i18n.localize("BLOCKINITIATIVE.PlayersReact")).then(() => {
                changeToPlayersReact(changeRound);
            });
            break;
        case game.i18n.localize("BLOCKINITIATIVE.PlayersAct").replace('\n', ''):
            await game.combat.setFlag("mg-block-initiative", "currentPhase", game.i18n.localize("BLOCKINITIATIVE.PlayersAct")).then(() => {
                changeToPlayersAct(changeRound);
            });
            break;
        case game.i18n.localize("BLOCKINITIATIVE.EnemiesReact").replace('\n', ''):
            await game.combat.setFlag("mg-block-initiative", "currentPhase", game.i18n.localize("BLOCKINITIATIVE.EnemiesReact")).then(() => {
                changeToEnemiesReact(changeRound);
            });
            break;
        case game.i18n.localize("BLOCKINITIATIVE.EnemiesAct").replace('\n', ''):
            await game.combat.setFlag("mg-block-initiative", "currentPhase", game.i18n.localize("BLOCKINITIATIVE.EnemiesAct")).then(() => {
                changeToEnemiesAct(changeRound);
            });
            break;
    }

    Hooks.call("changePhase", newPhase);
}

function changeToPlayersReact(changeRound?: boolean) {

}

function changeToPlayersAct(changeRound?: boolean) {
    game.combat.combatants.forEach((combatant: Combatant) => {
        if (combatant.hasPlayerOwner) {
            Hooks.call('pf2e.startTurn', combatant, game.combat);
        } else {
            Hooks.call('pf2e.endTurn', combatant, game.combat);
        }
        enableDisableReactionButtons(game.i18n.localize("BLOCKINITIATIVE.PlayersAct"))
    });

}
function changeToEnemiesReact(changeRound?: boolean) {

}

function changeToEnemiesAct(changeRound?: boolean) {
    game.combat.combatants.forEach((combatant: Combatant) => {
        if (!combatant.hasPlayerOwner) {
            Hooks.call('pf2e.startTurn', combatant, game.combat);
        } else {
            Hooks.call('pf2e.endTurn', combatant, game.combat);
        }
        enableDisableReactionButtons(game.i18n.localize("BLOCKINITIATIVE.EnemiesAct"))
    });
    if (socket) {
        socket.emit('module.mg-block-initiative', 'changePhase');
    }
}

// If called with no parameters, changes to the next phase in sequence, otherwise it changes to the phase given as a parameter.
// The sequence goes: Enemies Act -> Players React -> Players Act -> Enemies React -> Enemies Act and so forth.
// When changing from Players React -> Players Act, trigger all end-of-turn effects on enemies, and all start-of-turn effects on players.
// When changing from Enemies React -> Enemies Act, trigger all end-of-turn effects on players, and all start-of-turn effects on enemies.
// During a particular combat round, start-of-turn and end-of-turn effects can only trigger once. This guards against instances where the GM
// moving to a phase out of order (such as to make corrections) will not trigger these effects multiple times.
// TODO: Implement a memento system to simulate Undo/Redo instead.

function getMinMaxPlayerInitiative(combat: Combat): MinMaxInitiative {
    let highestPlayerInit = -999999;
    let lowestPlayerInit = 999999;

    combat.combatants.forEach((combatant: Combatant) => {
        if (combatant.hasPlayerOwner && combatant.initiative != null) {
            highestPlayerInit = Math.max(highestPlayerInit, combatant.initiative);
            lowestPlayerInit = Math.min(lowestPlayerInit, combatant.initiative);
        }
    });

    const minMaxInitiative = {
        playerInitMax: highestPlayerInit,
        playerInitMin: lowestPlayerInit,
    };

    return minMaxInitiative;
}

// Applies initiative handicap to a particular token, intended to be applied to players.
async function applyInitiativeHandicap(encounter: Combat) {
    // for every player combatant that has rolled initiative (indicated by their id being present in ids), handicap their initiative.
    for (const combatant of encounter.combatants) {
        if (combatant.hasPlayerOwner) {
            let initModifier: string = game.settings.get('mg-block-initiative', 'InitiativeHandicap') as string;
            initModifier = initModifier.startsWith('+') ? initModifier.split('+')[1] : initModifier;

            if (Number(initModifier)) {
                await encounter.setInitiative(combatant.id, combatant.initiative + Number(initModifier));
            } else {
                // TODO: throw error
            }
        }
    }
}

async function sortIntoBlockInitiative() {
    const encounter: Combat = game.combat;
    await applyInitiativeHandicap(encounter)

    // After handicap is applied, get min and max player initiative
    const initiative: MinMaxInitiative = getMinMaxPlayerInitiative(encounter);

    // move any npcs that rolled lower than the highest PC initiative to the bottom of initiative
    for (const encounterCombatant of encounter.combatants) {
        if (encounterCombatant.isNPC
            && encounterCombatant.initiative < initiative.playerInitMax
            && encounterCombatant.initiative >= initiative.playerInitMin) {
            await game.combat.setInitiative(encounterCombatant.id, initiative.playerInitMin - 1);
        }
    }
}

function createSortIntoBlocksButton() {
    //set title based on whether the user is player or GM
    const btnTitle: string = game.i18n.localize("BLOCKINITIATIVE.SortIntoBlocksButton");
    const sortIntoBlocksButton = $(`<a class="combat-control mg-block-initiative sort-into-blocks" title="${btnTitle}"><i class="fas fa-arrow-down"></i></a>`);
    const encounterTitle = $("#combat-round").find(`.encounter-title`);
    const sortIntoBlocksButtonAlreadyPresent = $("#combat-round").find(`.mg-block-initiative .sort-into-blocks`).length > 0;

    // Add the button to the sidebar if it doesn't already exist
    if (!sortIntoBlocksButtonAlreadyPresent) {
        encounterTitle.before(sortIntoBlocksButton);
        jQuery(".sort-into-blocks").on("click", sortIntoBlocksOnClick);
    }

    /**
     * Ready check button listener
     * @param event the button click event
     */
    function sortIntoBlocksOnClick(event: JQuery.ClickEvent) {
        event.preventDefault();
        void sortIntoBlockInitiative();
    }
}

function createCombatantButtons() {
    const currentUser = game.user;
    const currentCombatants = game.combat.data.combatants;
    if (currentUser.isGM) {
        currentCombatants.forEach(combatant => {
            if (combatant.isNPC) {
                createCombatantButton(combatant, game.i18n.localize("BLOCKINITIATIVE.ReactionButton"), "mg-reaction", `<span class="activity-icon">R</span>`, reactionButtonListener); 
            } else {
                createCombatantButton(combatant, game.i18n.localize("BLOCKINITIATIVE.InvalidActionButton"), "mg-invalid-action", `<i class="fas fa-ban"></i>`, invalidActionButtonListener); 
                createCombatantButton(combatant, game.i18n.localize("BLOCKINITIATIVE.ConfirmActionButton"), "mg-confirm-action", `<i class="fas fa-question"></i>`, confirmActionButtonListener);
            }
        })
    } else {
        const ownedCombatants: Combatant[] = currentCombatants.filter(combatant => combatant.canUserModify(currentUser, "update"));
        ownedCombatants.forEach(combatant => {
            createCombatantButton(combatant, game.i18n.localize("BLOCKINITIATIVE.ReactionButton"), "mg-reaction", `<span class="activity-icon">R</span>`, reactionButtonListener); 
        })
    }
}
   
    

function createCombatantButton(combatant : Combatant, buttonTitle: string, buttonClass: string, buttonIcon: string, buttonListener: (event: JQuery.ClickEvent) => void, ) {
    const btnTitle: string = buttonTitle;

    const combatantButton = $(`<a class="combatant-control mg-block-initiative ${buttonClass}" style="color: var(--color-text-light-1)" title="${btnTitle}">${buttonIcon}</a>`);
    const combatantRow = $("#combat-tracker").find(`[data-combatant-id=${combatant.id}]`);
    const tokenEffects = combatantRow.find(`.token-effects`);
    const combatantButtonAlreadyPresent = combatantRow.find(`.combatant-control.mg-block-initiative.mg-confirm-action`).length > 0;

    // Add the button to the sidebar if it doesn't already exist
    if (!combatantButtonAlreadyPresent) {
        combatantButton.on("click", buttonListener);
        tokenEffects.before(combatantButton);
    }
}

function reactionButtonListener(event: JQuery.ClickEvent) {
    combatantButtonListener(event, "notifyReaction");
}

function invalidActionButtonListener(event: JQuery.ClickEvent) {
    combatantButtonListener(event, "notifyInvalidAction");
}

function confirmActionButtonListener(event: JQuery.ClickEvent) {
    combatantButtonListener(event, "notifyConfirmAction");
}

function combatantButtonListener(event: JQuery.ClickEvent, actionId: string) {
    event.preventDefault();

    const combatantId = event.currentTarget.parentElement.parentElement.parentElement.attributes['data-combatant-id'].value;

    if (socket) {
        socket.emit('module.mg-block-initiative', actionId, combatantId);
    }
}

function enableDisableReactionButtons(currentPhase: string) {
    game.combat.combatants.forEach((combatant: Combatant) => {
        const combatantRow = jQuery(`#combat-tracker > details > ol > li[data-combatant-id="${combatant.id}"]`);
        const combatantReactionButton = combatantRow.find(`div.token-name > div.combatant-controls > a.combatant-control.mg-block-initiative.reaction`);

        if (currentPhase === game.i18n.localize("BLOCKINITIATIVE.PlayersAct")) {
            if (combatant.hasPlayerOwner) {
                enableReactionButton(combatantReactionButton);
            } else {
                disableReactionButton(combatantReactionButton, false);
            }
        } else if (currentPhase === game.i18n.localize("BLOCKINITIATIVE.EnemiesAct")) {
            if (combatant.hasPlayerOwner) {
                disableReactionButton(combatantReactionButton, true);
            } else {
                enableReactionButton(combatantReactionButton);
            }
        } else {
            enableReactionButton(combatantReactionButton);
        }
    });
}

function enableReactionButton(button: JQuery<HTMLElement>) {
    button.attr('style', 'color: var(--color-text-light-1);');
    button.on('click', reactionButtonListener);
    button.attr('title', game.i18n.localize("BLOCKINITIATIVE.ReactionButton"));
}

function disableReactionButton(button: JQuery<HTMLElement>, isPlayer: boolean) {
    const buttonText = isPlayer ? game.i18n.localize("BLOCKINITIATIVE.PlayersCannotReact") : game.i18n.localize("BLOCKINITIATIVE.EnemiesCannotReact")
    button.attr('style', 'color: var(--color-text-dark-5);');
    button.off('click', reactionButtonListener);
    button.attr('title', buttonText);
}
/**
 * Gets an array of users that have a token in the current scene.
 * @returns The array of users
 */
function getUsersInCombat(): User[] {
    const usersInCombat: User[] = [];
    const combatants = game.combat.combatants;
    game.users.contents.forEach((user: User) => {
        combatants.forEach((combatant: Combatant) => {
            // permissions object that maps user ids to permission enums
            const tokenPermissions = combatant.actor.data.permission;

            // if the user owns this token, then they are in the scene.
            if (tokenPermissions[user.id] === 3 && !usersInCombat.includes(user)) {
                usersInCombat.push(user);
            }
        });
    });
    return usersInCombat;
}

class MinMaxInitiative {
    playerInitMax: number
    playerInitMin: number
}

class ReactionData {
    message: string
    users: User[]
}

enum CombatPhase {
    ENEMIES_ACT,
    PLAYERS_REACT,
    PLAYERS_ACT,
    ENEMIES_REACT
}
