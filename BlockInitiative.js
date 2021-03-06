// TODO #2: add ability to enable/disable discord integration in settings.
// TODO #3: Improve on commenting.


// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// Register Game Settings
Hooks.once("init", function () {
    game.settings.register("block-initiative", "showChatMessagesForUserUpdates", {
        name: game.i18n.localize("BLOCKINITIATIVE.SettingsChatMessagesForUserUpdatesTitle"),
        hint: game.i18n.localize("BLOCKINITIATIVE.SettingsChatMessagesForUserUpdatesHint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("block-initiative", "showChatMessagesForChecks", {
        name: game.i18n.localize("BLOCKINITIATIVE.SettingsChatMessagesForChecksTitle"),
        hint: game.i18n.localize("BLOCKINITIATIVE.SettingsChatMessagesForChecksHint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("block-initiative", "playAlertForCheck", {
        name: game.i18n.localize("BLOCKINITIATIVE.SettingsPlayAlertForChecksTitle"),
        hint: game.i18n.localize("BLOCKINITIATIVE.SettingsPlayAlertForChecksHint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("block-initiative", "checkAlertSoundPath", {
        name: game.i18n.localize("BLOCKINITIATIVE.SettingsCheckAlertSoundPathTitle"),
        hint: game.i18n.localize("BLOCKINITIATIVE.SettingsCheckAlertSoundPathHint"),
        scope: "world",
        config: true,
        default: 'modules/block-initiative/sounds/notification.mp3',
        type: String
    });

    // register settings menu
});

// setting menu
// <div id = "discord-id-config" class="app window-app form" data-appid=??? style="z-index: 101; width=660px; height = 554px; left: 630px; top: 191.5px;">
// <section class="window-content">
// <form autocomplete="off" onsubmit="event.preventDefault();">
// <header class = "table-header flexrow"> 
// </header>
// <s
//</form>
// </section>
// </div>





// Reset Status When the Game is Ready
Hooks.on("ready", async function () {
    // Ready-Check Module
    // await setAllToNotReady();
    setAllDiscordIDFlags();
    if (game.combat) {
        getPlayersInCombat();
    }
});

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// Set Up Buttons and Socket Stuff
Hooks.on('renderChatLog', async function () {
    createButtons();
    createSocketHandler();
});

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// Update the display of the Player UI.
Hooks.on('renderPlayerList', async function () {
    await updatePlayersWindow();
})

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// SET ALL USERS STATUS TO NOT READY (GM)
async function setAllToNotReady() {
    if (game.user.isGM) {
        for (var i = 0; i < game.users.contents.length; i++) {
            await game.users.contents[i].setFlag('block-initiative', 'isReady', false);
        }
    }
}

async function setAllDiscordIDFlags() {
    // TODO #1: Get these values from the settings instead of hardcoding like this
    for (var i = 0; i < game.users.contents.length; i++) {
        if (await game.users.contents[i].data.name === "Khankar") {
            await game.users.contents[i].setFlag('block-initiative', 'discordID', "356634652963897345");
        } else if (await game.users.contents[i].data.name === "diablofan") {
            await game.users.contents[i].setFlag('block-initiative', 'discordID', "202599187332857873");
        } else if (await game.users.contents[i].data.name === "Ace-Meow5") {
            await game.users.contents[i].setFlag('block-initiative', 'discordID', "310978975805472768");
        } else if (await game.users.contents[i].data.name === "thugmunch") {
            await game.users.contents[i].setFlag('block-initiative', 'discordID', "315620825426558976");
        } else if (await game.users.contents[i].data.name === "??+j??") {
            await game.users.contents[i].setFlag('block-initiative', 'discordID', "501187142073057282");
        }
    }
}
// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// CREATE THE UI BUTTON FOR THE GM AND PLAYERS
function createButtons() {
    let btnTitle = game.i18n.localize("BLOCKINITIATIVE.UiChangeButton");

    if (game.user.role === 4) { //if GM
        btnTitle = game.i18n.localize("BLOCKINITIATIVE.UiGmButton");
    }

    const sidebarBtn = $(`<a class="crash-block-initiative-sidebar" title="` + btnTitle + `"><i class="fas fa-hourglass-half"></i></a>`);
    const popoutBtn = $(`<a class="crash-block-initiative-popout" title="` + btnTitle + `"><i class="fas fa-hourglass-half"></i></a>`);
    let sidebarDiv = $("#sidebar").find(".chat-control-icon");
    let popoutDiv = $("#chat-popout").find(".chat-control-icon");
    let btnAlreadyInSidebar = $("#sidebar").find(".crash-block-initiative-sidebar").length > 0;
    let btnAlreadyInPopout = $("#chat-popout").find(".crash-block-initiative-popout").length > 0;

    if (!btnAlreadyInSidebar) {
        sidebarDiv.before(sidebarBtn);
        jQuery(".crash-block-initiative-sidebar").click(async (event) => {
            event.preventDefault();
            if (game.user.role === 4) { displayGmDialog(); }
            else { displayStatusUpdateDialog(); }
        });
    }

    if (!btnAlreadyInPopout) {
        popoutDiv.before(popoutBtn);
        jQuery(".crash-block-initiative-popout").click(async (event) => {
            event.preventDefault();
            if (game.user.role === 4) { displayGmDialog(); }
            else { displayStatusUpdateDialog(); }
        });
    }

}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// CREATE THE SOCKET HANDLER
function createSocketHandler() {
    game.socket.on('module.block-initiative', async (data) => {
        if (data.action === 'check') {
            displayReadyCheckDialog();
        }
        else if (data.action === 'update') {
            processReadyResponse(data);
        }
    });
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// DISPLAY DIALOG ASKING GM WHAT THEY WANT TO DO
function displayGmDialog() {
    let buttons = {
        check: {
            icon: "<i class='fas fa-check'></i>",
            label: game.i18n.localize("BLOCKINITIATIVE.GmDialogButtonCheck"),
            callback: initReadyCheck
        },
        status: {
            icon: "<i class='fas fa-hourglass-half'></i>",
            label: game.i18n.localize("BLOCKINITIATIVE.GmDialogButtonStatus"),
            callback: displayStatusUpdateDialog
        }
    };
    new Dialog({
        title: game.i18n.localize("BLOCKINITIATIVE.GmDialogTitle"),
        content: `<p>${game.i18n.localize("BLOCKINITIATIVE.GmDialogContent")}</p>`,
        buttons: buttons,
        default: "check"
    }).render(true);
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// INITIATE A READY CHECK (GM)
async function initReadyCheck() {
    if (game.user.isGM) {
        let data = { action: 'check' };
        await setAllToNotReady();
        game.socket.emit('module.block-initiative', data);
        displayReadyCheckDialog();
        playReadyCheckAlert();
    } else {
        ui.notifications.error(game.i18n.localize("BLOCKINITIATIVE.ErrorNotGM"));
    }
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// DISPLAY STATUS UPDATE DIALOG AND SEND RESPONSE TO GM
function displayStatusUpdateDialog() {
    let data = { action: 'update', ready: false, userId: game.user.data._id };
    let buttons = {
        yes: {
            icon: "<i class='fas fa-check'></i>",
            label: game.i18n.localize("BLOCKINITIATIVE.StatusReady"),
            callback: () => { data.ready = true; updateReadyStatus(data); displayStatusUpdateChatMessage(data); /* Block-Initiative */ checkStatusForMessages() }
        },
        no: {
            icon: "<i class='fas fa-times'></i>",
            label: game.i18n.localize("BLOCKINITIATIVE.StatusNotReady"),
            callback: () => { data.ready = false; updateReadyStatus(data); displayStatusUpdateChatMessage(data); /* Players can't be all ready if one of them checked "Not Ready", so no need to call the method to check here */ }
        }
    };

    new Dialog({
        title: game.i18n.localize("BLOCKINITIATIVE.DialogTitleStatusUpdate"),
        content: `<p>${game.i18n.localize("BLOCKINITIATIVE.DialogContentStatusUpdate")}</p>`,
        buttons: buttons,
        default: "yes"
    }).render(true);
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// DISPLAY READY CHECK DIALOG AND SEND RESPONSE TO GM (PLAYER)
function displayReadyCheckDialog() {
    let data = { action: 'update', ready: false, userId: game.user.data._id };
    let buttons = {
        yes: {
            icon: "<i class='fas fa-check'></i>",
            label: game.i18n.localize("BLOCKINITIATIVE.StatusReady"),
            callback: async () => { data.ready = true; updateReadyStatus(data); displayReadyCheckChatMessage(data); /* Block-Initiative */ checkStatusForMessages() }
        }
    };

    new Dialog({
        title: game.i18n.localize("BLOCKINITIATIVE.DialogTitleReadyCheck"),
        content: `<p>${game.i18n.localize("BLOCKINITIATIVE.DialogContentReadyCheck")}</p>`,
        buttons: buttons,
        default: "yes"
    }).render(true);
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// UPDATE USER READY STATUS
//  If the user is a GM, just update it since the socket go to the sender, and none of the recipients (players)
//  will have the permissions require to update user flags. If the user is not a GM, emit that socket.
async function updateReadyStatus(data) {
    if (game.user.isGM) {
        processReadyResponse(data);
    } else {
        game.socket.emit('module.block-initiative', data);
    }
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// PROCESS READY CHECK RESPONSE (GM)
async function processReadyResponse(data) {
    if (game.user.isGM) {
        let userToUpdate = game.users.get(data.userId);
        await userToUpdate.setFlag('block-initiative', 'isReady', data.ready);
        ui.players.render();
    }
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// DISPLAY A CHAT MESSAGE WHEN A USER RESPONDS TO A READY CHECK
function displayReadyCheckChatMessage(data) {
    if (game.settings.get("block-initiative", "showChatMessagesForChecks")) {
        let username = game.users.get(data.userId).data.name;
        let content = `${username} ${game.i18n.localize("BLOCKINITIATIVE.ChatTextCheck")}`;
        ChatMessage.create({ speaker: { alias: "Ready Set Go!" }, content: content });
    }
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// DISPLAY A CHAT MESSAGE WHEN A USER UPDATES THEIR STATUS
function displayStatusUpdateChatMessage(data) {
    if (game.settings.get("block-initiative", "showChatMessagesForUserUpdates")) {
        let username = game.users.get(data.userId).data.name;
        let status = data.ready ? game.i18n.localize("BLOCKINITIATIVE.StatusReady") : game.i18n.localize("BLOCKINITIATIVE.StatusNotReady");
        let content = `${username} ${game.i18n.localize("BLOCKINITIATIVE.ChatTextUserUpdate")} ${status}`;
        ChatMessage.create({ speaker: { alias: "Ready Set Go!" }, content: content });
    }
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// PLAY SOUND EFFECT ASSOCIATED WITH READY CHECK START
function playReadyCheckAlert() {
    let playAlert = game.settings.get("block-initiative", "playAlertForCheck");
    let alertSound = game.settings.get("block-initiative", "checkAlertSoundPath");
    if (playAlert && !alertSound) {
        AudioHelper.play({ src: "modules/block-initiative/sounds/notification.mp3", volume: 1, autoplay: true, loop: false }, true);
    } else if (playAlert && alertSound) {
        AudioHelper.play({ src: alertSound, volume: 1, autoplay: true, loop: false }, true);
    }
}

// TODO #4: Remove Ready-Check Module methods from this codebase, allow them to be implemented in the other module.
// Ready-Check Module
// UPDATE PLAYER UI
async function updatePlayersWindow() {
    for (var i = 0; i < game.users.contents.length; i++) {
        let ready = await game.users.contents[i].getFlag('block-initiative', 'isReady');
        let userId = game.users.contents[i].data._id;
        let userName = game.users.contents[i].data.name;
        let indicator = $("#players").find("[data-user-id=" + userId + "] .crash-ready-indicator").length > 0;
        let title, classToAdd, classToRemove, iconClassToAdd, iconClassToRemove;

        if (ready) {
            title = game.i18n.localize("BLOCKINITIATIVE.PlayerReady");
            classToAdd = "ready";
            classToRemove = "not-ready";
            iconClassToAdd = "fa-check";
            iconClassToRemove = "fa-times";
        } else {
            title = game.i18n.localize("BLOCKINITIATIVE.PlayerNotReady");
            classToAdd = "not-ready";
            classToRemove = "ready";
            iconClassToAdd = "fa-times";
            iconClassToRemove = "fa-check";
        }

        if (indicator) {
            $(indicator).removeClass(classToRemove);
            $(indicator).removeClass(iconClassToRemove);
            $(indicator).addClass(classToAdd);
            $(indicator).addClass(iconClassToAdd);
        } else {
            $("#players").find("[data-user-id=" + userId + "]").append(`<i class="fas ${iconClassToAdd} crash-ready-indicator ${classToAdd}" title="${title}"></i>`);
        }
    }
}

// Block-Initiative Module
// If the appropriate conditions are met, send a message over discord informing players it is their turn.
async function checkStatusForMessages() {
    let text;
    if (game.user.hasPlayerOwner && AreUsersReady(false)) {
        text = game.i18n.localize("BLOCKINITIATIVE.ResolvePlayerActionsMessage");
    } else if (AreUsersReady(true)) {
        text = game.i18n.localize("BLOCKINITIATIVE.PlayersReactMessage");
    } else {
        return;
    }
    let userList = await getUserDiscordIDs(game.user.hasPlayerOwner)
    let message = buildMessage(userList, text)
    sendDiscordMessage(message);
}

// Block-Initiative Module
async function AreUsersReady(getGMs) {
    // check to see if all users are ready
    let userList = [];
    for (let i = 0; i < game.users.contents.length; i++) {
        let user = game.users.contents[i]
        // if any users are not ready, then we don't want to do anything.
        if (!(await user.getFlag('block-initiative', 'isReady'))) {
            return false;
        }
        if ((!getGMs && user.hasPlayerOwner)
            || (getGMs && !user.hasPlayerOwner)) {

            userList.push(user.data.name)
        }
    }
    return true;
}

// Block-Initiative Module
async function sendDiscordMessage(message) {
    $.ajax({
        method: 'POST',
        url: game.i18n.localize("BLOCKINITIATIVE.DiscordUrl"),
        contentType: "application/json",
        data: message,
    });
}

// Block-Initiative Module
function buildMessage(pingTargets, message) {
    let messageString = "";
    for (let i = 0; i < pingTargets.length; i++) {
        messageString += "<@" + pingTargets[i] + "> "
    }
    let messageJSON = {
        "content": messageString + " " + message
    }

    let messageReturn = JSON.stringify(messageJSON);

    return messageReturn;
}

// Block-Initiative Module
function getPlayersInCombat() {
    let usersInCombat = [];
    let combatants = Array.from(game.combat.combatants.values());
    let actorIDs = [];
    for (let i = 0; i < combatants.length; i++) {
        actorIDs.push(combatants[i].data.actorId);
    }
    for (let j = 0; j < game.users.contents.length; j++) {
        let user = game.users.contents[j];
        if (user.isGM) {
            usersInCombat.push(user);
        } else if (!user.isGM && user.character) {
            let characterID = user.character.id;
            if (actorIDs.indexOf(characterID) != -1) {
                usersInCombat.push(user);
            }
        }
    }
    return usersInCombat;
}

// Block-Initiative Module
async function getUserDiscordIDs(getGMs) {
    let users;
    if (game.combat) {
        users = getPlayersInCombat();
    } else {
        users = game.users.contents;
    }
    let targetUsers = [];
    for (let i = 0; i < users.length; i++) {
        let user = users[i];
        if ((getGMs && !user.hasPlayerOwner) ||
            (!getGMs && user.hasPlayerOwner)) {

            targetUsers.push(await user.getFlag('block-initiative', 'discordID'));
        }
    }
    return targetUsers;
}


