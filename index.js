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
                                    reactions: {
                                        type: 'object',
                                        properties: {
                                            heartCount: { type: 'number' },
                                            userReacted: { type: 'boolean' }
                                        }
                                    }
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
                            reactions: {
                                type: 'object',
                                properties: {
                                    likeCount: { type: 'number' },
                                    userReacted: { type: 'boolean' }
                                }
                            }
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
            memberSchema: {
                properties: {
                    value: {
                        required: ['activity', 'target'],
                        properties: {
                            activity: { const: 'Join' },
                            target: { type: 'string' }
                        }
                    }
                }
            },
            inviteSchema: {
                properties: {
                    value: {
                        required: ['activity', 'object', 'target'],
                        properties: {
                            activity: { const: 'Invite' },
                            object: { type: 'string' },
                            target: { type: 'string' }
                        }
                    }
                }
            },
            removeSchema: {
                properties: {
                    value: {
                        required: ['activity', 'object', 'target'],
                        properties: {
                            activity: { const: 'Remove' },
                            object: { type: 'string' },
                            target: { type: 'string' }
                        }
                    }
                }
            },
            leaveSchema: {
                properties: {
                    value: {
                        required: ['activity', 'target'],
                        properties: {
                            activity: { const: 'Leave' },
                            target: { type: 'string' }
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

            const messageObj = {
                value: {
                    content: this.myMessage,
                    published: this.scheduleEnabled 
                        ? new Date(this.scheduledTime).getTime()
                        : Date.now(),
                    scheduled: this.scheduleEnabled,
                    reactions: {
                        likeCount: 0,
                        userReacted: false
                    }
                },
                channels: [this.selectedChannel],
            };

            if (this.scheduleEnabled && messageObj.value.published - Date.now() < 300000) {
                alert('Scheduled time must be at least 5 minutes from now');
                return;
            }

            this.sending = true;
            try {
                await this.$graffiti.put(messageObj, session);
                this.myMessage = '';
                this.scheduleEnabled = false;
                this.scheduledTime = '';
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
                        reactions: {
                            heartCount: 0,
                            userReacted: false
                        }
                    }
                },
                channels: ['designftw']
            }, this.$graffitiSession.value);
            
            this.newChatName = '';
        },

        selectGroup(group) {
            this.selectedChannel = group.channel;
            this.currentGroupName = group.name;
            this.groupNameEdit = group.name;
        },

        async updateGroupName() {
            await this.$graffiti.put({
                value: {
                    name: this.groupNameEdit,
                    describes: this.selectedChannel
                },
                channels: [this.selectedChannel]
            }, this.$graffitiSession.value);
        },

        async editMessage(message) {
            const newContent = prompt("Edit message:", message.value.content);
            if (newContent && newContent !== message.value.content) {
                await this.$graffiti.patch({
                    value: [{
                        op: 'replace',
                        path: '/value/content',
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

        async handleReaction(messageObject, emoji) {
            try {
                const currentReactions = messageObject.value.reactions || {
                    likeCount: 0,
                    userReacted: false
                };
                
                const newReactions = {
                    likeCount: currentReactions.userReacted 
                        ? currentReactions.likeCount - 1 
                        : currentReactions.likeCount + 1,
                    userReacted: !currentReactions.userReacted
                };

                const op = messageObject.value.reactions ? 'replace' : 'add';

                await this.$graffiti.patch({
                    value: [{
                        op,
                        path: '/reactions',
                        value: newReactions
                    }]
                }, messageObject, this.$graffitiSession.value);
            } catch (error) {
                console.error('Reaction update failed:', error);
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
        }


        
    }
});

app.directive('focus', {
    mounted(el) {
        el.focus();
    }
});

app.use(GraffitiPlugin, {
    //graffiti: new GraffitiLocal(),
    graffiti: new GraffitiRemote(),
})
.mount("#app");
