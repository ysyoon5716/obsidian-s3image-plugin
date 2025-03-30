import { App, Editor, Plugin, PluginSettingTab, Setting, moment } from 'obsidian';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

interface MyPluginSettings {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	bucket: string;
}


const DEFAULT_SETTINGS: MyPluginSettings = {
	accessKeyId: 'YOUR_ACCESS_KEY_ID',
	secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
	region: 'YOUR_REGION',
	bucket: 'YOUR_BUCKET'
}


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	s3: S3Client

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MySettingTab(this.app, this));
		this.s3 = new S3Client({
			region: this.settings.region,
			credentials: {
				accessKeyId: this.settings.accessKeyId,
				secretAccessKey: this.settings.secretAccessKey,
			}
		});
		this.registerEvent(this.app.workspace.on('editor-paste', this.handlePaste))
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}


	handlePaste = async (e: ClipboardEvent, editor: Editor) => {
		const files = e.clipboardData?.files;
		if (!files) return;
		if (files.length === 0) return;
		for (let i = 0; i < files.length; i += 1) {
			if (!files[i].type.startsWith('image')) return;
		};

		e.preventDefault();
		for (let i = 0; i < files.length; i += 1) {
			const file = files[i];
			const url = await this.uploadFile(file);
			editor.replaceSelection(`![](${url})`);
		} 
	}

	async uploadFile(file: File): Promise<string> {
		const fileExtension = file.name.split('.').pop();
		const fileName = moment().format('YYYYMMDDHHmmssSS') + '.' + fileExtension;

		const arrayBuffer = await file.arrayBuffer();
		const fileBuffer = Buffer.from(arrayBuffer);

		const params = {
			Bucket: this.settings.bucket,
			Key: fileName,
			Body: fileBuffer,
			ContentType: file.type,
		};

		console.log(typeof file);
		const result = await this.s3.send(new PutObjectCommand(params));
		const url = `https://${this.settings.bucket}.s3.${this.settings.region}.amazonaws.com/${fileName}`;
		return url
	}
}


class MySettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'AWS S3 Configuration'});

		new Setting(containerEl)
			.setName('Access Key ID')
			.addText(text => text
				.setValue(this.plugin.settings.accessKeyId)
				.onChange(async (value) => {
					this.plugin.settings.accessKeyId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Secret Access Key')
			.addText(text => text
				.setValue(this.plugin.settings.secretAccessKey)
				.onChange(async (value) => {
					this.plugin.settings.secretAccessKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Region')
			.addText(text => text
				.setValue(this.plugin.settings.region)
				.onChange(async (value) => {
					this.plugin.settings.region = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bucket')
			.addText(text => text
				.setValue(this.plugin.settings.bucket)
				.onChange(async (value) => {
					this.plugin.settings.bucket = value;
					await this.plugin.saveSettings();
				}));
	}
}
