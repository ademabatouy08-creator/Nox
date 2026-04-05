// ==================================================================================
// ⚡ OTF SYSTEM | UNITÉ D'ÉLITE DAYZ PS5
// 🖥️ VERSION : 1.0 — CORE ENGINE REFORGE
// 🛠️ DEVELOPER : OTF CORE ENGINE
// 📜 DESCRIPTION : Système tactique ultra-avancé — protection, commandement & recrutement.
// ==================================================================================

const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
    TextInputStyle, PermissionFlagsBits, ChannelType, MessageFlags,
    ActivityType, Events, StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const express = require('express');

// --- SERVER KEEP-ALIVE (FOR RENDER) ---
const app = express();
app.get('/', (req, res) => res.send('⚡ OTF SYSTEM V1.0 : FULLY OPERATIONAL'));
app.listen(process.env.PORT || 10000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

// --- CORE SYSTEM ASSETS ---
const NOX_LOGO = 'https://i.imgur.com/vH9v5Z9.png'; // Remplace par ton logo OTF
const LINE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const THIN  = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

const COLORS = {
    SUCCESS : '#00ff88',
    DANGER  : '#ff2244',
    WARNING : '#ffaa00',
    INFO    : '#00ccff',
    NEUTRAL : '#1a1a2e',
    SPECIAL : '#7700ff',
    NOX     : '#0d0d0d',
    KIA     : '#8b0000',
    RAID    : '#ff0000',
    DEFCON5 : '#00ff88',
    DEFCON3 : '#ffaa00',
    DEFCON1 : '#ff0000'
};

const DEFCON_COLORS = { '5': COLORS.DEFCON5, '3': COLORS.DEFCON3, '1': COLORS.DEFCON1 };
const DEFCON_LABELS = {
    '5': '5 ─ STABILITÉ OPÉRATIONNELLE',
    '3': '3 ─ ALERTE MODÉRÉE',
    '1': '1 ─ GUERRE TOTALE'
};

// --- GLOBAL MEMORY DATABASE ---
let config = {
    logs: null, dispatch: null, welcome: null, role: null,
    antiPub: false, spamLimit: 0,
    defcon: '5', maintenance: false,
    mutedUsers: new Map()    // userId => { until: timestamp, reason }
};

const userSpamMap  = new Map();
const cooldownMap  = new Map(); // userId => last /raid timestamp

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function noxEmbed(title, color = COLORS.NOX) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setThumbnail(NOX_LOGO)
        .setFooter({ text: `⚡ OTF SYSTEM • ${new Date().toLocaleString('fr-FR')}` })
        .setTimestamp();
}

function isAdmin(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isMod(member) {
    return member.permissions.has(PermissionFlagsBits.ManageMessages);
}

async function sendLog(guild, embed) {
    if (!config.logs) return;
    const ch = guild.channels.cache.get(config.logs);
    if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    return `${Math.floor(s / 3600)}h`;
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

client.once('clientReady', async () => {
    console.log(`\n${LINE}\n⚡ OTF SYSTEM V1.0 : DÉPLOYÉ AVEC SUCCÈS\n${LINE}\n`);

    client.user.setPresence({
        activities: [{ name: `⚡ DEFCON ${DEFCON_LABELS[config.defcon]} | OTF`, type: ActivityType.Competing }],
        status: 'dnd'
    });

    // ── SLASH COMMANDS ──────────────────────────────────────────────────────
    const MAP_CHOICES = [
        { name: 'Chernarus', value: 'Chernarus' },
        { name: 'Sakhal',    value: 'Sakhal'    },
        { name: 'Livonia',   value: 'Livonia'   }
    ];

    const commands = [
        // ── OPÉRATIONNEL ──
        {
            name: 'setco',
            description: '📍 Marquer une position stratégique (Base / Cache / Point de passage)',
            options: [
                { name: 'lieu',     type: 3, description: 'Désignation du point (ex: Base PBY)',         required: true },
                { name: 'map',      type: 3, description: 'Carte concernée',                             required: true, choices: MAP_CHOICES },
                { name: 'serveur',  type: 3, description: 'Identifiant du serveur (ex: #4521)',           required: true },
                { name: 'longueur', type: 3, description: 'Coordonnée X (Longitude)',                    required: true },
                { name: 'hauteur',  type: 3, description: 'Coordonnée Y (Latitude)',                     required: true },
                { name: 'type',     type: 3, description: 'Type de point',                               required: false,
                  choices: [
                      { name: '🏚️ Base principale', value: 'BASE' },
                      { name: '📦 Cache / Planque',  value: 'CACHE' },
                      { name: '🔭 Point de guet',   value: 'GUET' },
                      { name: '🚗 Point de rally',  value: 'RALLY' }
                  ]
                }
            ]
        },
        {
            name: 'info',
            description: '📊 Renseigner manuellement l\'état d\'un serveur DayZ PS5',
            options: [
                { name: 'serveur',  type: 3, description: 'Nom ou numéro du serveur',          required: true },
                { name: 'joueurs',  type: 3, description: 'Nombre de joueurs vus en jeu',       required: true },
                { name: 'map',      type: 3, description: 'Carte du serveur',                   required: true,
                  choices: [
                      { name: 'Chernarus', value: 'Chernarus' },
                      { name: 'Sakhal',    value: 'Sakhal'    },
                      { name: 'Livonia',   value: 'Livonia'   }
                  ]
                },
                { name: 'etat',     type: 3, description: 'État général du serveur',            required: true,
                  choices: [
                      { name: '🟢 Calme',       value: 'CALME'    },
                      { name: '🟡 Actif',        value: 'ACTIF'    },
                      { name: '🔴 Très chargé', value: 'CHARGE'   },
                      { name: '⚫ Inconnu',      value: 'INCONNU'  }
                  ]
                },
                { name: 'notes',    type: 3, description: 'Infos supplémentaires (optionnel)',  required: false }
            ]
        },
        {
            name: 'mort',
            description: '💀 Signaler un opérateur K.I.A et transmettre la position du loot',
            options: [
                { name: 'map',      type: 3, description: 'Localisation du décès', required: true, choices: MAP_CHOICES },
                { name: 'longueur', type: 3, description: 'Position X du loot',   required: true },
                { name: 'hauteur',  type: 3, description: 'Position Y du loot',   required: true },
                { name: 'cause',    type: 3, description: 'Cause du décès (optionnel)', required: false,
                  choices: [
                      { name: '🔫 Tué par joueur', value: 'PVP' },
                      { name: '🧟 Tué par zombie', value: 'ZOMBIE' },
                      { name: '💀 Mort environnementale', value: 'ENV' },
                      { name: '❓ Cause inconnue', value: 'UNKNOWN' }
                  ]
                }
            ]
        },
        {
            name: 'raid',
            description: '🚨 PROTOCOLE D\'ALERTE MAXIMALE — RAID ENNEMI DÉTECTÉ',
            options: [
                { name: 'lieu',   type: 3, description: 'Zone d\'engagement prioritaire', required: true },
                { name: 'nombre', type: 4, description: 'Nombre d\'ennemis estimé',       required: false }
            ]
        },
        {
            name: 'status',
            description: '🖥️ Afficher le statut complet du système OTF'
        },
        // ── COMMANDEMENT ──
        {
            name: 'defcon',
            description: '🚨 Paramétrer le niveau de vigilance global de l\'unité',
            options: [{
                name: 'niveau', type: 3, description: 'Niveau d\'urgence opérationnel', required: true,
                choices: [
                    { name: 'DEFCON 5 ─ Stabilité', value: '5' },
                    { name: 'DEFCON 3 ─ Alerte Modérée', value: '3' },
                    { name: 'DEFCON 1 ─ GUERRE TOTALE', value: '1' }
                ]
            }]
        },
        {
            name: 'mute',
            description: '🔇 Réduire au silence un opérateur indiscipliné',
            options: [
                { name: 'membre', type: 6, description: 'Opérateur à muter',              required: true },
                { name: 'duree',  type: 4, description: 'Durée en minutes (0 = permanent)', required: true },
                { name: 'raison', type: 3, description: 'Motif de sanction',               required: false }
            ]
        },
        {
            name: 'unmute',
            description: '🔊 Lever la sanction audio d\'un opérateur',
            options: [
                { name: 'membre', type: 6, description: 'Opérateur à démuter', required: true }
            ]
        },
        {
            name: 'kick',
            description: '👢 Expulser un opérateur du serveur',
            options: [
                { name: 'membre', type: 6, description: 'Opérateur à expulser', required: true },
                { name: 'raison', type: 3, description: 'Motif d\'expulsion',   required: false }
            ]
        },
        {
            name: 'warn',
            description: '⚠️ Envoyer un avertissement officiel à un opérateur',
            options: [
                { name: 'membre', type: 6, description: 'Opérateur à avertir', required: true },
                { name: 'raison', type: 3, description: 'Motif de l\'avertissement', required: true }
            ]
        },
        // ── ADMINISTRATION ──
        {
            name: 'setup-aegis',
            description: '🛡️ Configurer le bouclier anti-raid du serveur',
            options: [
                { name: 'antipub',  type: 5, description: 'Bloquer les invitations Discord ?',    required: true },
                { name: 'antispam', type: 4, description: 'Nombre max de msgs/3sec (0 = OFF)', required: true }
            ]
        },
        {
            name: 'setup-global',
            description: '⚙️ Configurer les hubs de données OTF',
            options: [
                { name: 'logs',    type: 7, description: 'Salon de surveillance ADMIN',      required: true },
                { name: 'dispatch',type: 7, description: 'Salon des transmissions tactiques',required: true },
                { name: 'accueil', type: 7, description: 'Salon de réception des recrues',   required: true },
                { name: 'role',    type: 8, description: 'Rôle attribué à l\'arrivée',       required: true }
            ]
        },
        { name: 'setup-recrutement', description: '👑 Déployer l\'interface de candidature OTF' },
        {
            name: 'dmall',
            description: '📨 Envoyer un DM à tous les membres du serveur',
            options: [
                { name: 'texte', type: 3, description: 'Message à envoyer à tous les membres', required: true }
            ]
        },
        {
            name: 'dm-all',
            description: '📨 Envoyer un DM à tous les membres du serveur',
            options: [
                { name: 'message', type: 3, description: 'Message à envoyer à tous les membres', required: true }
            ]
        },
        {
            name: 'annonce',
            description: '📣 Publier une annonce officielle OTF dans un salon',
            options: [
                { name: 'salon',  type: 7, description: 'Salon où envoyer l\'annonce',  required: true },
                { name: 'titre',  type: 3, description: 'Titre de l\'annonce',           required: true },
                { name: 'texte',  type: 3, description: 'Contenu de l\'annonce',         required: true },
                { name: 'ping',   type: 5, description: 'Mentionner @everyone ?',         required: false }
            ]
        },
        {
            name: 'message',
            description: '✉️ Envoyer un message privé à un membre via le bot',
            options: [
                { name: 'membre', type: 6, description: 'Membre à contacter',            required: true },
                { name: 'texte',  type: 3, description: 'Contenu du message',            required: true }
            ]
        },
        {
            name: 'clear',
            description: '🧹 Purge des communications obsolètes',
            options: [{ name: 'nombre', type: 4, description: 'Volume de messages à supprimer (1-100)', required: true }]
        },
        {
            name: 'maintenance',
            description: '🛠️ Verrouillage / Déverrouillage du serveur',
            options: [{ name: 'etat', type: 5, description: 'Activer le mode maintenance ?', required: true }]
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log("💎 MODULES OTF SYNCHRONISÉS — OPÉRATIONNEL.");
    } catch (e) {
        console.error("❌ ERREUR CRITIQUE COMMANDES:", e);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE PROTECTION : AEGIS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

client.on(Events.MessageCreate, async m => {
    if (m.author.bot || !m.guild) return;

    // ── Maintenance lock ──
    if (config.maintenance && !isAdmin(m.member)) {
        await m.delete().catch(() => {});
        return;
    }

    // ── Anti-pub ──
    if (config.antiPub && !isMod(m.member)) {
        if (/(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/.+/i.test(m.content)) {
            await m.delete().catch(() => {});
            const log = noxEmbed('🚷 VIOLATION PROTOCOLE — PUBLICITÉ DÉTECTÉE', COLORS.DANGER)
                .addFields(
                    { name: '👤 Opérateur', value: `${m.author}`,              inline: true },
                    { name: '📢 Canal',     value: `${m.channel}`,             inline: true },
                    { name: '📄 Contenu',   value: `\`\`\`${m.content}\`\`\`` }
                );
            sendLog(m.guild, log);
            const warn = await m.channel.send(`⛔ **ALERTE OTF :** ${m.author} — La publicité externe est interdite.`);
            setTimeout(() => warn.delete().catch(() => {}), 5000);
            return;
        }
    }

    // ── Anti-spam ──
    if (config.spamLimit > 0 && !isMod(m.member)) {
        const now  = Date.now();
        const data = userSpamMap.get(m.author.id) || { count: 0, last: now };
        data.count = (now - data.last < 3000) ? data.count + 1 : 1;
        data.last  = now;
        userSpamMap.set(m.author.id, data);

        if (data.count > config.spamLimit) {
            await m.delete().catch(() => {});
            if (data.count === config.spamLimit + 1) {
                const warn = await m.channel.send(`⚠️ **CONTRÔLE OTF :** ${m.author} — Cadence d'émission trop élevée. Réduisez la fréquence.`);
                setTimeout(() => warn.delete().catch(() => {}), 4000);
                const log = noxEmbed('⚠️ VIOLATION PROTOCOLE — SPAM DÉTECTÉ', COLORS.WARNING)
                    .addFields(
                        { name: '👤 Opérateur', value: `${m.author}`,  inline: true },
                        { name: '📢 Canal',     value: `${m.channel}`, inline: true },
                        { name: '📊 Messages',  value: `\`${data.count} msgs / 3s\`` }
                    );
                sendLog(m.guild, log);
            }
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE COMMANDES SLASH
// ─────────────────────────────────────────────────────────────────────────────

client.on(Events.InteractionCreate, async i => {
    if (!i.isChatInputCommand()) return;
    const { commandName, guild, member, user } = i;

    // ── /SETCO ────────────────────────────────────────────────────────────────
    if (commandName === 'setco') {
        if (!config.dispatch) return i.reply({ content: "⚠️ Aucun canal Dispatch configuré. Utilisez `/setup-global`.", flags: MessageFlags.Ephemeral });

        const lieu   = i.options.getString('lieu');
        const map    = i.options.getString('map');
        const serveur= i.options.getString('serveur');
        const x      = i.options.getString('longueur');
        const y      = i.options.getString('hauteur');
        const type   = i.options.getString('type') || 'BASE';

        const typeIcon = { BASE:'🏚️', CACHE:'📦', GUET:'🔭', RALLY:'🚗' };

        const embed = noxEmbed(`${typeIcon[type]} POSITION TACTIQUE — ${type}`, COLORS.SUCCESS)
            .setAuthor({ name: `OTF TACTICAL SCAN • ${user.username}`, iconURL: user.displayAvatarURL() })
            .setDescription(`${LINE}\n**DÉSIGNATION :** ${lieu}\n**TYPE :**       ${typeIcon[type]} ${type}\n**CARTE :**      ${map}  •  Serveur \`${serveur}\`\n**COORDONNÉES :** \`X: ${x}  |  Y: ${y}\`\n${LINE}\n*Données transmises à l'unité de dispatch OTF.*`);

        guild.channels.cache.get(config.dispatch)?.send({ embeds: [embed] });
        return i.reply({ content: `📍 Position **${lieu}** transmise au Dispatch.`, flags: MessageFlags.Ephemeral });
    }

    // ── /INFO ─────────────────────────────────────────────────────────────────
    if (commandName === 'info') {
        const serveur = i.options.getString('serveur');
        const joueurs = i.options.getString('joueurs');
        const map     = i.options.getString('map');
        const etat    = i.options.getString('etat');
        const notes   = i.options.getString('notes') || 'Aucune';

        const etatLabel = { CALME: '🟢 Calme', ACTIF: '🟡 Actif', CHARGE: '🔴 Très chargé', INCONNU: '⚫ Inconnu' };
        const etatColor = { CALME: COLORS.SUCCESS, ACTIF: COLORS.WARNING, CHARGE: COLORS.DANGER, INCONNU: COLORS.NEUTRAL };

        const embed = noxEmbed(`📊 RAPPORT SERVEUR — ${serveur}`, etatColor[etat])
            .setAuthor({ name: `Signalement par ${user.username}`, iconURL: user.displayAvatarURL() })
            .setDescription(`> ⚠️ *Informations renseignées manuellement par un membre OTF — pas en temps réel.*`)
            .addFields(
                { name: '🗺️ Carte',       value: `\`${map}\``,         inline: true },
                { name: '👥 Joueurs vus', value: `\`${joueurs}\``,      inline: true },
                { name: '📶 État',         value: etatLabel[etat],       inline: true },
                { name: '📋 Notes',        value: `\`${notes}\``,      inline: false }
            );
        return i.reply({ embeds: [embed] });
    }

    // ── /MORT ─────────────────────────────────────────────────────────────────
    if (commandName === 'mort') {
        const map   = i.options.getString('map');
        const x     = i.options.getString('longueur');
        const y     = i.options.getString('hauteur');
        const cause = i.options.getString('cause') || 'UNKNOWN';
        const causeLabel = { PVP:'🔫 Tué par joueur', ZOMBIE:'🧟 Tué par zombie', ENV:'💀 Environnementale', UNKNOWN:'❓ Inconnue' };

        const embed = noxEmbed('💀 RAPPORT K.I.A — OPÉRATEUR TOMBÉ', COLORS.KIA)
            .setDescription(`${LINE}\n**UNITÉ :** ${user}\n**SECTEUR :** ${map}\n**COORDONNÉES :** \`X: ${x}  |  Y: ${y}\`\n**CAUSE :** ${causeLabel[cause]}\n${LINE}\n*Équipe de récupération — en attente d'ordres.*`);

        return i.reply({ content: '⚠️ **OTF ALERT — UNITÉ K.I.A DÉTECTÉE !**', embeds: [embed] });
    }

    // ── /RAID ─────────────────────────────────────────────────────────────────
    if (commandName === 'raid') {
        const lieu   = i.options.getString('lieu');
        const nombre = i.options.getInteger('nombre');

        // Cooldown anti-spam (30s)
        const lastRaid = cooldownMap.get(user.id) || 0;
        if (Date.now() - lastRaid < 30000) {
            const reste = Math.ceil((30000 - (Date.now() - lastRaid)) / 1000);
            return i.reply({ content: `⏳ Cooldown raid actif — attends encore **${reste}s**.`, flags: MessageFlags.Ephemeral });
        }
        cooldownMap.set(user.id, Date.now());

        const embed = noxEmbed('🚨  ALERTE ROUGE — RAID HOSTILE DÉTECTÉ  🚨', COLORS.RAID)
            .setDescription(`${LINE}\n**ZONE CRITIQUE :**  ${lieu}\n**EFFECTIF ENNEMI :** ${nombre ? `\`≈ ${nombre} cibles\`` : '`Non évalué`'}\n**PRIORITÉ :**  🔴 ABSOLUE\n**ORDRE :**  TOUT LE MONDE EN JEU ET EN VOCAL IMMÉDIATEMENT\n${LINE}`)
            .setImage(NOX_LOGO);

        return i.reply({ content: '@everyone ⚔️ **MOBILISATION TOTALE — OTF !**', embeds: [embed] });
    }

    // ── /STATUS ───────────────────────────────────────────────────────────────
    if (commandName === 'status') {
        const embed = noxEmbed('⚡ OTF SYSTEM — RAPPORT DE STATUT', COLORS.INFO)
            .addFields(
                { name: '🛡️ DEFCON',       value: `\`DEFCON ${DEFCON_LABELS[config.defcon]}\``,  inline: false },
                { name: '🔧 Maintenance',   value: config.maintenance ? '`🔴 ACTIVE`' : '`🟢 INACTIVE`', inline: true },
                { name: '🚷 Anti-pub',      value: config.antiPub ? '`🟢 ON`' : '`🔴 OFF`',            inline: true },
                { name: '⚠️ Anti-spam',     value: config.spamLimit > 0 ? `\`🟢 ${config.spamLimit} msgs/3s\`` : '`🔴 OFF`', inline: true },
                { name: '📡 Dispatch',      value: config.dispatch ? `<#${config.dispatch}>` : '`Non configuré`', inline: true },
                { name: '📋 Logs',          value: config.logs     ? `<#${config.logs}>`     : '`Non configuré`', inline: true },
                { name: '🏠 Accueil',       value: config.welcome  ? `<#${config.welcome}>`  : '`Non configuré`', inline: true },
                { name: '🏓 Ping bot',      value: `\`${client.ws.ping}ms\``,                           inline: true }
            );
        return i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ── /DEFCON ───────────────────────────────────────────────────────────────
    if (commandName === 'defcon') {
        if (!isAdmin(member)) return i.reply({ content: "⛔ Privilèges administrateur requis.", flags: MessageFlags.Ephemeral });
        const niveau = i.options.getString('niveau');
        config.defcon = niveau;
        client.user.setActivity(`⚡ DEFCON ${DEFCON_LABELS[niveau]} | OTF`, { type: ActivityType.Competing });

        const embed = noxEmbed('🚨 PROTOCOLE DEFCON — NIVEAU MODIFIÉ', DEFCON_COLORS[niveau])
            .setDescription(`${LINE}\n**NOUVEAU NIVEAU :**\n\`\`\`DEFCON ${DEFCON_LABELS[niveau]}\`\`\`\n**ORDRE :** Adapter les protocoles en conséquence.\n${LINE}`)
            .setAuthor({ name: `Commandement OTF • ${user.username}`, iconURL: user.displayAvatarURL() });

        const log = noxEmbed('⚡ DEFCON MODIFIÉ', DEFCON_COLORS[niveau])
            .addFields(
                { name: 'Nouveau niveau', value: `\`DEFCON ${niveau}\``, inline: true },
                { name: 'Modifié par',    value: `${user}`,              inline: true }
            );
        sendLog(guild, log);
        return i.reply({ embeds: [embed] });
    }

    // ── /MUTE ─────────────────────────────────────────────────────────────────
    if (commandName === 'mute') {
        if (!isMod(member)) return i.reply({ content: "⛔ Permissions insuffisantes.", flags: MessageFlags.Ephemeral });
        const cible  = i.options.getMember('membre');
        const duree  = i.options.getInteger('duree');
        const raison = i.options.getString('raison') || 'Non spécifié';

        if (!cible) return i.reply({ content: "⚠️ Opérateur introuvable.", flags: MessageFlags.Ephemeral });
        if (isAdmin(cible)) return i.reply({ content: "⛔ Impossible de muter un administrateur.", flags: MessageFlags.Ephemeral });

        const until = duree > 0 ? Date.now() + duree * 60000 : null;
        const timeoutDur = duree > 0 ? duree * 60 * 1000 : 28 * 24 * 60 * 60 * 1000; // max 28j Discord

        try {
            await cible.timeout(timeoutDur, raison);
            const embed = noxEmbed('🔇 SANCTION — MUTE APPLIQUÉ', COLORS.WARNING)
                .addFields(
                    { name: '👤 Opérateur', value: `${cible}`,                                   inline: true },
                    { name: '⏱️ Durée',    value: duree > 0 ? `\`${duree} min\`` : '`Permanent`', inline: true },
                    { name: '📋 Motif',    value: `\`${raison}\``,                                inline: false }
                );
            sendLog(guild, embed);
            return i.reply({ embeds: [embed] });
        } catch (e) {
            return i.reply({ content: `❌ Impossible de muter : \`${e.message}\``, flags: MessageFlags.Ephemeral });
        }
    }

    // ── /UNMUTE ───────────────────────────────────────────────────────────────
    if (commandName === 'unmute') {
        if (!isMod(member)) return i.reply({ content: "⛔ Permissions insuffisantes.", flags: MessageFlags.Ephemeral });
        const cible = i.options.getMember('membre');
        if (!cible) return i.reply({ content: "⚠️ Opérateur introuvable.", flags: MessageFlags.Ephemeral });

        try {
            await cible.timeout(null);
            const embed = noxEmbed('🔊 SANCTION LEVÉE — UNMUTE', COLORS.SUCCESS)
                .addFields({ name: '👤 Opérateur', value: `${cible}`, inline: true });
            sendLog(guild, embed);
            return i.reply({ embeds: [embed] });
        } catch (e) {
            return i.reply({ content: `❌ Impossible de démuter : \`${e.message}\``, flags: MessageFlags.Ephemeral });
        }
    }

    // ── /KICK ─────────────────────────────────────────────────────────────────
    if (commandName === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) return i.reply({ content: "⛔ Permissions insuffisantes.", flags: MessageFlags.Ephemeral });
        const cible  = i.options.getMember('membre');
        const raison = i.options.getString('raison') || 'Non spécifié';

        if (!cible) return i.reply({ content: "⚠️ Opérateur introuvable.", flags: MessageFlags.Ephemeral });
        if (isAdmin(cible)) return i.reply({ content: "⛔ Impossible d'expulser un administrateur.", flags: MessageFlags.Ephemeral });

        try {
            await cible.send(`👢 Tu as été expulsé du serveur OTF.\n**Motif :** \`${raison}\``).catch(() => {});
            await cible.kick(raison);
            const embed = noxEmbed('👢 EXPULSION — OPÉRATEUR BANNI', COLORS.DANGER)
                .addFields(
                    { name: '👤 Opérateur', value: `\`${cible.user.tag}\``, inline: true },
                    { name: '📋 Motif',     value: `\`${raison}\``,          inline: true }
                );
            sendLog(guild, embed);
            return i.reply({ embeds: [embed] });
        } catch (e) {
            return i.reply({ content: `❌ Impossible d'expulser : \`${e.message}\``, flags: MessageFlags.Ephemeral });
        }
    }

    // ── /WARN ─────────────────────────────────────────────────────────────────
    if (commandName === 'warn') {
        if (!isMod(member)) return i.reply({ content: "⛔ Permissions insuffisantes.", flags: MessageFlags.Ephemeral });
        const cible  = i.options.getMember('membre');
        const raison = i.options.getString('raison');

        if (!cible) return i.reply({ content: "⚠️ Opérateur introuvable.", flags: MessageFlags.Ephemeral });

        const embedTarget = noxEmbed('⚠️ AVERTISSEMENT OFFICIEL — OTF', COLORS.WARNING)
            .setDescription(`${LINE}\nVous avez reçu un **avertissement officiel** du commandement OTF.\n**Motif :** \`${raison}\`\nTout récidive pourra entraîner une sanction plus sévère.\n${LINE}`);

        await cible.send({ embeds: [embedTarget] }).catch(() => {});

        const log = noxEmbed('⚠️ AVERTISSEMENT ÉMIS', COLORS.WARNING)
            .addFields(
                { name: '👤 Cible',     value: `${cible}`,          inline: true },
                { name: '🔰 Émis par', value: `${user}`,            inline: true },
                { name: '📋 Motif',    value: `\`${raison}\``,       inline: false }
            );
        sendLog(guild, log);
        return i.reply({ content: `⚠️ Avertissement envoyé à ${cible}.`, flags: MessageFlags.Ephemeral });
    }

    // ── /SETUP-AEGIS ──────────────────────────────────────────────────────────
    if (commandName === 'setup-aegis') {
        if (!isAdmin(member)) return i.reply({ content: "⛔ Admin requis.", flags: MessageFlags.Ephemeral });
        config.antiPub   = i.options.getBoolean('antipub');
        config.spamLimit = i.options.getInteger('antispam');

        const embed = noxEmbed('🛡️ BOUCLIER AEGIS — CONFIGURATION MISE À JOUR', COLORS.SPECIAL)
            .addFields(
                { name: '🚷 Anti-publicité', value: config.antiPub ? '`🟢 ACTIVÉ`' : '`🔴 DÉSACTIVÉ`', inline: true },
                { name: '⚠️ Anti-spam',      value: config.spamLimit > 0 ? `\`🟢 MAX ${config.spamLimit} msgs/3s\`` : '`🔴 DÉSACTIVÉ`', inline: true }
            );
        return i.reply({ embeds: [embed] });
    }

    // ── /SETUP-GLOBAL ─────────────────────────────────────────────────────────
    if (commandName === 'setup-global') {
        if (!isAdmin(member)) return i.reply({ content: "⛔ Admin requis.", flags: MessageFlags.Ephemeral });
        config.logs     = i.options.getChannel('logs').id;
        config.dispatch = i.options.getChannel('dispatch').id;
        config.welcome  = i.options.getChannel('accueil').id;
        config.role     = i.options.getRole('role').id;

        const embed = noxEmbed('⚙️ CONFIGURATION GLOBALE OTF — VALIDÉE', COLORS.SUCCESS)
            .addFields(
                { name: '📋 Logs',     value: `<#${config.logs}>`,     inline: true },
                { name: '📡 Dispatch', value: `<#${config.dispatch}>`, inline: true },
                { name: '🏠 Accueil',  value: `<#${config.welcome}>`,  inline: true },
                { name: '🎖️ Rôle',    value: `<@&${config.role}>`,    inline: true }
            );
        return i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ── /SETUP-RECRUTEMENT ────────────────────────────────────────────────────
    if (commandName === 'setup-recrutement') {
        const embed = noxEmbed('⚡ OTF — UNITÉ D\'ÉLITE DAYZ PS5 • RECRUTEMENT', COLORS.SPECIAL)
            .setDescription(
                `${LINE}\n` +
                `Rejoins l'unité la plus organisée et redoutée sur **DayZ PS5**.\n\n` +
                `**✅ Serveurs privés**\n` +
                `**✅ Entraînements PVP intensifs**\n` +
                `**✅ Hiérarchie militaire structurée**\n` +
                `**✅ Coordination tactique avancée**\n` +
                `**✅ Communauté soudée**\n` +
                `${LINE}\n` +
                `*Clique sur le bouton ci-dessous pour soumettre ta candidature.*`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('otf_apply')
                .setLabel('REJOINDRE OTF')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚡')
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    // ── /DM-ALL ───────────────────────────────────────────────────────────────
    if (commandName === 'dm-all') {
        if (!isAdmin(member)) return i.reply({ content: "⛔ Admin requis.", flags: MessageFlags.Ephemeral });

        const texte = i.options.getString('message');
        await i.reply({ content: "📨 Envoi en cours...", flags: MessageFlags.Ephemeral });

        let success = 0;
        let failed = 0;

        const members = await guild.members.fetch();

        const embed = noxEmbed('📨 MESSAGE OFFICIEL OTF', COLORS.SPECIAL)
            .setDescription(`${LINE}
${texte}
${LINE}`)
            .setFooter({ text: `Message du commandement OTF • ${guild.name}` });

        for (const [, m] of members) {
            if (m.user.bot) continue;
            try {
                await m.send({ embeds: [embed] });
                success++;
                await new Promise(r => setTimeout(r, 1000)); // anti rate-limit
            } catch {
                failed++;
            }
        }

        const log = noxEmbed('📨 DM COLLECTIF ENVOYÉ', COLORS.SPECIAL)
            .addFields(
                { name: '✅ Succès',  value: `\`${success}\``, inline: true },
                { name: '❌ Échecs', value: `\`${failed}\``,  inline: true },
                { name: '🔰 Par',    value: `${user}`,         inline: true },
                { name: '📋 Message', value: `\`${texte.substring(0, 500)}\``, inline: false }
            );
        sendLog(guild, log);
        return i.editReply(`✅ DM envoyé — **${success}** succès, **${failed}** échecs (DMs fermés).`);
    }

    // ── /DMALL ───────────────────────────────────────────────────────────────
    if (commandName === 'dmall') {
        if (!isAdmin(member)) return i.reply({ content: "⛔ Admin requis.", flags: MessageFlags.Ephemeral });

        const texte = i.options.getString('texte');

        // Boutons de confirmation
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`dmall_confirm_${i.id}`).setLabel('✅ CONFIRMER ENVOI').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`dmall_cancel_${i.id}`).setLabel('❌ ANNULER').setStyle(ButtonStyle.Secondary)
        );

        const preview = noxEmbed('📨 PREVISUALISATION DU DM — CONFIRMATION REQUISE', COLORS.WARNING)
            .setDescription(`**Contenu du message :**
\`\`\`${texte}\`\`\`
⚠️ Ce message sera envoyé en DM à **tous les membres** du serveur.
Confirme en cliquant ci-dessous.`);

        // Stocker le texte temporairement
        client._dmallPending = client._dmallPending || new Map();
        client._dmallPending.set(i.id, texte);

        return i.reply({ embeds: [preview], components: [row], flags: MessageFlags.Ephemeral });
    }

    // ── /ANNONCE ──────────────────────────────────────────────────────────────
    if (commandName === 'annonce') {
        if (!isMod(member)) return i.reply({ content: "⛔ Permissions insuffisantes.", flags: MessageFlags.Ephemeral });
        const salon = i.options.getChannel('salon');
        const titre = i.options.getString('titre');
        const texte = i.options.getString('texte');
        const ping  = i.options.getBoolean('ping') || false;

        const embed = noxEmbed(`📣 ${titre}`, COLORS.SPECIAL)
            .setAuthor({ name: `Annonce OTF • ${user.username}`, iconURL: user.displayAvatarURL() })
            .setDescription(`${LINE}
${texte}
${LINE}`)
            .setTimestamp();

        const ch = guild.channels.cache.get(salon.id);
        if (!ch) return i.reply({ content: "⚠️ Salon introuvable.", flags: MessageFlags.Ephemeral });

        await ch.send({ content: ping ? '@everyone' : null, embeds: [embed] });

        const log = noxEmbed('📣 ANNONCE PUBLIÉE', COLORS.SPECIAL)
            .addFields(
                { name: '📢 Salon',   value: `${salon}`,        inline: true },
                { name: '🔰 Par',    value: `${user}`,          inline: true },
                { name: '📋 Titre',  value: `\`${titre}\``,     inline: false }
            );
        sendLog(guild, log);
        return i.reply({ content: `✅ Annonce publiée dans ${salon}.`, flags: MessageFlags.Ephemeral });
    }

    // ── /MESSAGE ──────────────────────────────────────────────────────────────
    if (commandName === 'message') {
        if (!isMod(member)) return i.reply({ content: "⛔ Permissions insuffisantes.", flags: MessageFlags.Ephemeral });
        const cible = i.options.getMember('membre');
        const texte = i.options.getString('texte');

        if (!cible) return i.reply({ content: "⚠️ Membre introuvable.", flags: MessageFlags.Ephemeral });

        const embed = noxEmbed('✉️ MESSAGE OFFICIEL OTF', COLORS.INFO)
            .setDescription(`${LINE}
${texte}
${LINE}`)
            .setFooter({ text: `Message envoyé par le commandement OTF • ${guild.name}` });

        try {
            await cible.send({ embeds: [embed] });
            const log = noxEmbed('✉️ MESSAGE PRIVÉ ENVOYÉ', COLORS.INFO)
                .addFields(
                    { name: '👤 Destinataire', value: `${cible}`, inline: true },
                    { name: '🔰 Envoyé par',   value: `${user}`,  inline: true },
                    { name: '📋 Contenu',      value: `\`${texte.substring(0, 500)}\``, inline: false }
                );
            sendLog(guild, log);
            return i.reply({ content: `✅ Message envoyé à ${cible}.`, flags: MessageFlags.Ephemeral });
        } catch (e) {
            return i.reply({ content: `❌ Impossible d'envoyer le message — l'utilisateur a peut-être bloqué les DMs.`, flags: MessageFlags.Ephemeral });
        }
    }

    // ── /CLEAR ────────────────────────────────────────────────────────────────
    if (commandName === 'clear') {
        if (!isMod(member)) return i.reply({ content: "⛔ Permissions insuffisantes.", flags: MessageFlags.Ephemeral });
        const n = Math.min(i.options.getInteger('nombre'), 100);
        const deleted = await i.channel.bulkDelete(n, true).catch(() => null);
        const count = deleted ? deleted.size : '?';

        const log = noxEmbed('🧹 PURGE DES MESSAGES', COLORS.WARNING)
            .addFields(
                { name: '🗑️ Quantité', value: `\`${count} messages\``, inline: true },
                { name: '📢 Canal',    value: `${i.channel}`,           inline: true },
                { name: '🔰 Par',      value: `${user}`,                inline: true }
            );
        sendLog(guild, log);
        return i.reply({ content: `🧹 **${count}** message(s) supprimé(s).`, flags: MessageFlags.Ephemeral });
    }

    // ── /MAINTENANCE ──────────────────────────────────────────────────────────
    if (commandName === 'maintenance') {
        if (!isAdmin(member)) return i.reply({ content: "⛔ Admin requis.", flags: MessageFlags.Ephemeral });
        config.maintenance = i.options.getBoolean('etat');

        const embed = noxEmbed('🛠️ MODE MAINTENANCE', config.maintenance ? COLORS.DANGER : COLORS.SUCCESS)
            .setDescription(
                config.maintenance
                    ? `${LINE}\n🔴 **SERVEUR VERROUILLÉ**\nSeuls les administrateurs peuvent interagir.\n${LINE}`
                    : `${LINE}\n🟢 **SERVEUR DÉVERROUILLÉ**\nRetour à l'opération normale.\n${LINE}`
            );
        return i.reply({ embeds: [embed] });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE TICKETS : RECRUTEMENT — MODALS & BOUTONS
// ─────────────────────────────────────────────────────────────────────────────

client.on(Events.InteractionCreate, async i => {
    // ── Bouton DM ALL confirmation ───────────────────────────────────────────
    if (i.isButton() && i.customId.startsWith('dmall_confirm_')) {
        if (!isAdmin(i.member)) return i.reply({ content: "⛔ Admin requis.", flags: MessageFlags.Ephemeral });

        const interactionId = i.customId.replace('dmall_confirm_', '');
        const texte = client._dmallPending?.get(interactionId);
        if (!texte) return i.reply({ content: "⚠️ Session expirée. Relance la commande.", flags: MessageFlags.Ephemeral });

        client._dmallPending.delete(interactionId);

        await i.update({ content: "⏳ Envoi en cours...", embeds: [], components: [] });

        const membres = await i.guild.members.fetch();
        const humains = membres.filter(m => !m.user.bot);

        const embed = new EmbedBuilder()
            .setColor(COLORS.SPECIAL)
            .setTitle('✉️ MESSAGE OFFICIEL OTF')
            .setDescription(`${LINE}
${texte}
${LINE}`)
            .setFooter({ text: `Message du commandement OTF • ${i.guild.name}` })
            .setTimestamp();

        let succes = 0, echecs = 0;

        for (const [, m] of humains) {
            try {
                await m.send({ embeds: [embed] });
                succes++;
                await new Promise(r => setTimeout(r, 500)); // anti-ratelimit
            } catch { echecs++; }
        }

        const rapport = noxEmbed('📨 DM ALL — RAPPORT ENVOI', COLORS.SUCCESS)
            .addFields(
                { name: '✅ Envoyés',  value: `\`${succes}\``,  inline: true },
                { name: '❌ Échoués', value: `\`${echecs}\``,  inline: true },
                { name: '👥 Total',   value: `\`${succes + echecs}\``, inline: true }
            );

        const log = noxEmbed('📨 DM ALL EXÉCUTÉ', COLORS.WARNING)
            .addFields(
                { name: '🔰 Par',      value: `${i.user}`,       inline: true },
                { name: '✅ Succès',  value: `\`${succes}\``,    inline: true },
                { name: '❌ Échecs',  value: `\`${echecs}\``,    inline: true },
                { name: '📋 Message', value: `\`${texte.substring(0, 500)}\`` }
            );
        sendLog(i.guild, log);

        return i.editReply({ content: null, embeds: [rapport], components: [] });
    }

    if (i.isButton() && i.customId.startsWith('dmall_cancel_')) {
        const interactionId = i.customId.replace('dmall_cancel_', '');
        client._dmallPending?.delete(interactionId);
        return i.update({ content: "❌ Envoi annulé.", embeds: [], components: [] });
    }

    // ── Bouton candidature ────────────────────────────────────────────────────
    if (i.isButton() && i.customId === 'otf_apply') {
        const modal = new ModalBuilder()
            .setCustomId('otf_modal')
            .setTitle('⚡ DOSSIER CANDIDATURE OTF');

        const psn = new TextInputBuilder()
            .setCustomId('psn')
            .setLabel("🎮 IDENTIFIANT PSN")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ton pseudo PSN exact")
            .setRequired(true);

        const heures = new TextInputBuilder()
            .setCustomId('heures')
            .setLabel("⏱️ HEURES DE JEU SUR DAYZ")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ex : 1200")
            .setRequired(true);

        const age = new TextInputBuilder()
            .setCustomId('age')
            .setLabel("🎂 ÂGE")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ex : 20")
            .setRequired(true);

        const motivation = new TextInputBuilder()
            .setCustomId('motivation')
            .setLabel("📋 POURQUOI REJOINDRE OTF ?")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Présente-toi et explique ta motivation...")
            .setMinLength(30)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(psn),
            new ActionRowBuilder().addComponents(heures),
            new ActionRowBuilder().addComponents(age),
            new ActionRowBuilder().addComponents(motivation)
        );
        return await i.showModal(modal);
    }

    // ── Soumission modal ──────────────────────────────────────────────────────
    if (i.isModalSubmit() && i.customId === 'otf_modal') {
        await i.reply({ content: "⏳ Transmission du dossier au commandement OTF...", flags: MessageFlags.Ephemeral });

        const tk = await i.guild.channels.create({
            name: `recrue-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id,        deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id,         allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const dossier = noxEmbed('📂 NOUVEAU DOSSIER — CANDIDATURE OTF', COLORS.WARNING)
            .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
            .addFields(
                { name: '👤 Candidat',   value: `${i.user}`,                                     inline: true },
                { name: '🎮 PSN',         value: `\`${i.fields.getTextInputValue('psn')}\``,       inline: true },
                { name: '⏱️ Heures',     value: `\`${i.fields.getTextInputValue('heures')}h\``,   inline: true },
                { name: '🎂 Âge',        value: `\`${i.fields.getTextInputValue('age')} ans\``,   inline: true },
                { name: '📋 Motivation', value: i.fields.getTextInputValue('motivation') }
            );

        const btns = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('otf_accept').setLabel('ACCEPTER').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('otf_refuse').setLabel('REFUSER').setStyle(ButtonStyle.Danger).setEmoji('❌'),
            new ButtonBuilder().setCustomId('otf_close').setLabel('ARCHIVER').setStyle(ButtonStyle.Secondary).setEmoji('🗂️')
        );

        await tk.send({ content: `@here | 📂 Nouveau dossier à examiner — ${i.user}`, embeds: [dossier], components: [btns] });
        await i.editReply(`✅ Dossier transmis. Canal privé : ${tk}`);

        // Log global
        const log = noxEmbed('📂 NOUVELLE CANDIDATURE REÇUE', COLORS.SPECIAL)
            .addFields(
                { name: '👤 Candidat', value: `${i.user}`,          inline: true },
                { name: '🎮 PSN',      value: `\`${i.fields.getTextInputValue('psn')}\``, inline: true }
            );
        sendLog(i.guild, log);
    }

    // ── Boutons décision candidature ──────────────────────────────────────────
    if (i.isButton() && (i.customId === 'otf_accept' || i.customId === 'otf_refuse' || i.customId === 'otf_close')) {
        if (!isMod(i.member)) return i.reply({ content: "⛔ Permissions insuffisantes.", flags: MessageFlags.Ephemeral });

        if (i.customId === 'otf_accept') {
            // Récupérer le nom du candidat depuis le nom du salon
            const recrueName = i.channel.name.replace('recrue-', '');
            await i.reply(`✅ **Candidature acceptée** par ${i.user}. Bienvenue dans OTF, \`${recrueName}\` !`);

            const log = noxEmbed('✅ CANDIDATURE ACCEPTÉE', COLORS.SUCCESS)
                .addFields(
                    { name: '👤 Candidat', value: `\`${recrueName}\``, inline: true },
                    { name: '✅ Par',      value: `${i.user}`,          inline: true }
                );
            sendLog(i.guild, log);
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }

        if (i.customId === 'otf_refuse') {
            const recrueName = i.channel.name.replace('recrue-', '');
            await i.reply(`❌ **Candidature refusée** par ${i.user}.`);

            const log = noxEmbed('❌ CANDIDATURE REFUSÉE', COLORS.DANGER)
                .addFields(
                    { name: '👤 Candidat', value: `\`${recrueName}\``, inline: true },
                    { name: '❌ Par',      value: `${i.user}`,          inline: true }
                );
            sendLog(i.guild, log);
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }

        if (i.customId === 'otf_close') {
            await i.reply('🗂️ Archivage du dossier en cours...');
            setTimeout(() => i.channel.delete().catch(() => {}), 3000);
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE HUB : BIENVENUE & SURVEILLANCE
// ─────────────────────────────────────────────────────────────────────────────

client.on(Events.GuildMemberAdd, async m => {
    if (config.welcome) {
        if (config.role) m.roles.add(config.role).catch(() => {});

        const embed = noxEmbed('⚡ OTF — NOUVELLE UNITÉ DÉTECTÉE', COLORS.SUCCESS)
            .setDescription(
                `${LINE}\n` +
                `Bienvenue **${m.user.username}** dans la coalition **OTF**.\n\n` +
                `📋 Présente-toi dans le canal de recrutement.\n` +
                `🎮 Rejoins nos serveurs DayZ PS5.\n` +
                `⚡ Bonne mission, opérateur.\n` +
                `${LINE}`
            )
            .setThumbnail(m.user.displayAvatarURL({ dynamic: true }));

        m.guild.channels.cache.get(config.welcome)?.send({ content: `${m}`, embeds: [embed] });

        const log = noxEmbed('🛰️ NOUVEAU MEMBRE REJOINT', COLORS.INFO)
            .addFields(
                { name: '👤 Utilisateur', value: `${m.user.tag}`,  inline: true },
                { name: '📅 Compte créé', value: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`, inline: true }
            );
        sendLog(m.guild, log);
    }
});

client.on(Events.GuildMemberRemove, async m => {
    const log = noxEmbed('🚪 OPÉRATEUR DÉCONNECTÉ', COLORS.DANGER)
        .addFields({ name: '👤 Utilisateur', value: `${m.user.tag}`, inline: true });
    sendLog(m.guild, log);
});

client.on(Events.MessageDelete, async m => {
    if (!config.logs || m.author?.bot) return;
    const embed = noxEmbed('🗑️ LOG — MESSAGE SUPPRIMÉ', COLORS.DANGER)
        .addFields(
            { name: '👤 Auteur', value: m.author?.tag || 'Inconnu', inline: true },
            { name: '📢 Canal',  value: `${m.channel}`,             inline: true },
            { name: '📄 Contenu', value: `\`\`\`${m.content?.substring(0, 1000) || "[Contenu multimédia ou vide]"}\`\`\`` }
        );
    client.channels.cache.get(config.logs)?.send({ embeds: [embed] }).catch(() => {});
});

client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!config.logs || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    const embed = noxEmbed('✏️ LOG — MESSAGE MODIFIÉ', COLORS.WARNING)
        .addFields(
            { name: '👤 Auteur',  value: oldMsg.author?.tag || 'Inconnu',              inline: true },
            { name: '📢 Canal',   value: `${oldMsg.channel}`,                           inline: true },
            { name: '📄 Avant',   value: `\`\`\`${oldMsg.content?.substring(0, 500) || '?'}\`\`\`` },
            { name: '📄 Après',   value: `\`\`\`${newMsg.content?.substring(0, 500) || '?'}\`\`\`` }
        );
    client.channels.cache.get(config.logs)?.send({ embeds: [embed] }).catch(() => {});
});

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTION GLOBALE
// ─────────────────────────────────────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
    console.error('⚡ OTF SHIELD — ERREUR INTERCEPTÉE :', reason);
});

process.on('uncaughtException', (err) => {
    console.error('⚡ OTF SHIELD — EXCEPTION NON CAPTURÉE :', err);
});

// ─────────────────────────────────────────────────────────────────────────────
client.login(process.env.BOT_TOKEN);
