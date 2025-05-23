import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";
import reactionbutton from './ReactionButton.js'; 

const app = createApp({
    components: {
        reactionbutton,
    },
    data() {
        return {
            profile: {
                name: "",
                pronouns: "",
                bio: "",
                icon: "",
            },
            profileFile: null,
            profileUrl: "",
            editingProfile: false,
            recurring: {
            start: "",
            end: "",
            frequency: "none", // 'none', 'daily', 'weekly', 'monthly'
            },

            currentGroup:null,
            myMessage: "",
            sending: false,
            newChatName: "",
            selectedChannel: null,
            currentGroupName: "",
            groupNameEdit: "",
            scheduleEnabled: false,
            scheduledTime: "",
            groupSchema: {
                properties: {
                    value: {
                        required: ['activity', 'object'],
                        properties: {
                            activity: { const: 'Create' },
                            object: {
                                required: ['type', 'name', 'channel'],
                                properties: {
                                    type: { const: 'Group Chat' },
                                    name: { type: 'string' },
                                    channel: { type: 'string' },
                                }
                            }
                        }
                    }
                }
            },
            messageSchema: {
                properties: {
                    value: {
                        required: ['content', 'published'],
                        properties: {
                            content: { type: 'string' },
                            published: { type: 'number' },
                        }
                    }
                }
            },
            nameUpdateSchema: {
                properties: {
                    value: {
                        required: ['name', 'describes'],
                        properties: {
                            name: { type: 'string' },
                            describes: { type: 'string' }
                        }
                    }
                }
            },
            profileSchema: {
                properties: {
                    value: {
                        required: ['name', 'describes', 'published'],
                        properties: {
                            name: { type: 'string' },
                            pronouns: { type: 'string' },
                            bio: { type: 'string' },
                            icon: { type: 'string' },
                            describes: { type: 'string' },
                            published: { type: 'number' }
                        }
                    }
                }
            },
            reactionSchema: {
                properties: {
                    value: {
                        required: ['messageUrl'],
                        properties: {
                            messageUrl: {type: 'string'}
                        }
                    }
                }
            },
        };
    },

    computed: {
        minScheduleTime() {
            const now = new Date(Date.now() + 5 * 60 * 1000);
            const tzOffset = now.getTimezoneOffset() * 60000;
            const localTime = new Date(now.getTime() - tzOffset);
            return localTime.toISOString().slice(0, 16);
        }
    },
    methods: {
        async sendMessage(session) {
            if (!this.myMessage) return;

            if (this.scheduleEnabled && this.recurring.frequency !== "none") {
                const start = new Date(this.recurring.start).getTime();
                const end = this.recurring.end ? new Date(this.recurring.end).getTime() : start;
                let current = start;
                const times = [];
                while (current <= end && times.length < 366) {
                times.push(current);
                switch (this.recurring.frequency) {
                    case "daily": current += 24 * 60 * 60 * 1000; break;
                    case "weekly": current += 7 * 24 * 60 * 60 * 1000; break;
                    case "monthly": {
                    const d = new Date(current);
                    d.setMonth(d.getMonth() + 1);
                    current = d.getTime();
                    break;
                    }
                    default: break;
                }
                }
                const now = Date.now();
                if (times.some((t) => t - now < 5 * 60 * 1000)) {
                alert("All scheduled times must be at least 5 minutes from now");
                return;
                }
                this.sending = true;
                try {
                for (const t of times) {
                    const messageObj = {
                    value: {
                        content: this.myMessage,
                        published: t,
                        scheduled: true,
                    },
                    channels: [this.selectedChannel],
                    };
                    await this.$graffiti.put(messageObj, session);
                }
                this.myMessage = "";
                this.scheduleEnabled = false;
                this.recurring = { start: "", end: "", frequency: "none" };
                } finally {
                this.sending = false;
                this.$nextTick(() => this.$refs.messageInput?.focus());
                }
                return;
            }

            const messageObj = {
                value: {
                content: this.myMessage,
                published: this.scheduleEnabled
                    ? new Date(this.recurring.start).getTime()
                    : Date.now(),
                scheduled: this.scheduleEnabled,
                },
                channels: [this.selectedChannel],
            };

            if (
                this.scheduleEnabled &&
                messageObj.value.published - Date.now() < 5 * 60 * 1000
            ) {
                alert("Scheduled time must be at least 5 minutes from now");
                return;
            }
            this.sending = true;
            try {
                await this.$graffiti.put(messageObj, session);
                this.myMessage = "";
                this.scheduleEnabled = false;
                this.recurring = { start: "", end: "", frequency: "none" };
            } finally {
                this.sending = false;
                this.$nextTick(() => this.$refs.messageInput?.focus());
            }
        },


        async createGroupChat() {
            if (!this.newChatName) return;
            
            await this.$graffiti.put({
                value: {
                    activity: 'Create',
                    object: {
                        type: 'Group Chat',
                        name: this.newChatName,
                        channel: crypto.randomUUID(),
                    }
                },
                channels: ['designftw']
            }, this.$graffitiSession.value);
            
            this.newChatName = '';
        },

        selectGroup(group) {
            let x = group.value.object;
            this.selectedChannel = x.channel;
            this.currentGroupName = x.name;
            this.groupNameEdit = x.name;
            this.currentGroup = group;
        },

        async updateGroupName() {
            await this.$graffiti.patch({
                value: [{
                    op: 'replace',
                    path: '/object/name',
                    value: this.groupNameEdit
                }]
                
            }, this.currentGroup, this.$graffitiSession.value);
            this.currentGroupName = this.groupNameEdit;
        },

        async editMessage(message) {
            const newContent = prompt("Edit message:", message.value.content);
            if (newContent && newContent !== message.value.content) {
                await this.$graffiti.patch({
                    value: [{
                        op: 'replace',
                        path: '/content',
                        value: newContent
                    }]
                }, message, this.$graffitiSession.value);
            }
        },

        async deleteMessage(message) {
            if (confirm("Delete this message?")) {
                await this.$graffiti.delete(message, this.$graffitiSession.value);
            }
        },

        formatFutureTime(timestamp) {
            const now = Date.now();
            if (timestamp <= now) return 'Now';
            
            const diffSeconds = Math.floor((timestamp - now) / 1000);
            const hours = Math.floor(diffSeconds / 3600);
            const minutes = Math.floor((diffSeconds % 3600) / 60);
            
            return `in ${hours}h ${minutes}m`;
        },

        async handleReaction(message, reactionObjects) {
            const myReaction = reactionObjects.find(
            r => r.value.messageUrl === message.url && r.actor === this.$graffitiSession.value.actor
            );
            if (myReaction) {
                await this.$graffiti.delete(myReaction.url, this.$graffitiSession.value);
            } else {
                const reactionObj = {
                    value : {
                        messageUrl: message.url,
                    },
                    channels : [this.selectedChannel]
                }
                await this.$graffiti.put(reactionObj, this.$graffitiSession.value);
            }
        },

        async saveProfile() {
            const actor = this.$graffitiSession.value.actor;
            const profileObj = {
                value: {
                    name: this.profile.name,
                    pronouns: this.profile.pronouns,
                    bio: this.profile.bio,
                    icon: this.profile.icon,
                    describes: actor,
                    published: Date.now(),
                    generator: "https://albertlu03.github.io/chat-app/",
                },
                channels: [actor, "designftw-2025-studio2"]
            };
            await this.$graffiti.put(profileObj, this.$graffitiSession.value);
            this.editingProfile = false;
        },

        async loadProfile() {
            const actor = this.$graffitiSession.value.actor;
            const { objects: profiles } = await this.$graffiti.discover({
                channels: [actor],
                schema: this.profileSchema
            });
            if (profiles && profiles.length > 0) {
                profiles.sort((a, b) => b.value.published - a.value.published);
                const latest = profiles[0].value;
                this.profile = {
                    name: latest.name || "",
                    pronouns: latest.pronouns || "",
                    bio: latest.bio || "",
                    icon: latest.icon || ""
                };
                this.profileUrl = latest.icon || "";
            }
        },

        formatDate(time) {
            let date = new Date(time);
            return date.toISOString();
        },
        
        formatTime(time) {
            let date = new Date(time);
            return date.getHours()+":"+date.getMinutes();
        },

        maxRecurringEnd() {
            if (!this.recurring.start) return "";
            const start = new Date(this.recurring.start);
            start.setFullYear(start.getFullYear() + 1);
            return start.toISOString().slice(0, 16);
        },
        recurringPreview() {
            if (!this.scheduleEnabled || this.recurring.frequency === 'none' || !this.recurring.start) return [];
            const preview = [];
            let current = new Date(this.recurring.start).getTime();
            const end = this.recurring.end ? new Date(this.recurring.end).getTime() : current;
            let count = 0;
            while (current <= end && count < 10) {
                preview.push(current);
                switch (this.recurring.frequency) {
                case 'daily': current += 24 * 60 * 60 * 1000; break;
                case 'weekly': current += 7 * 24 * 60 * 60 * 1000; break;
                case 'monthly': {
                    const d = new Date(current);
                    d.setMonth(d.getMonth() + 1);
                    current = d.getTime();
                    break;
                }
                default: break;
                }
                count++;
            }
            return preview;
        },

        formatDate(ts) {
            return new Date(ts).toLocaleString();
        },
    }
});

app.directive('focus', {
    mounted(el) {
        el.focus();
    }
});

app.use(GraffitiPlugin, {
    graffiti: new GraffitiLocal(),
    //graffiti: new GraffitiRemote(),
})
.mount("#app");