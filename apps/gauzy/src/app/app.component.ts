/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { SeoService } from './@core/utils/seo.service';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IDateRangePicker, ILanguage, LanguagesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common-angular';
import { filter, map, mergeMap, tap } from 'rxjs';
import * as _ from 'underscore';
import { AnalyticsService } from './@core/utils/analytics.service';
import {
	DateRangePickerBuilderService,
	DEFAULT_DATE_PICKER_CONFIG,
	DEFAULT_SELECTOR_VISIBILITY,
	IDatePickerConfig,
	ISelectorVisibility,
	LanguagesService,
	SelectorBuilderService,
	Store,
} from './@core/services';
import { environment } from '../environments/environment';
import { JitsuService } from './@core/services/analytics/jitsu.service';
import { union } from 'underscore';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-app',
	template: '<router-outlet *ngIf="!loading"></router-outlet>',
})
export class AppComponent implements OnInit, AfterViewInit {
	loading: boolean = true;

	constructor(
		private readonly jitsuService: JitsuService,
		private readonly analytics: AnalyticsService,
		private readonly seoService: SeoService,
		private readonly store: Store,
		private readonly languagesService: LanguagesService,
		public readonly translate: TranslateService,
		private readonly router: Router,
		private readonly activatedRoute: ActivatedRoute,
		public readonly selectorBuilderService: SelectorBuilderService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		this.getActivateRouterDataEvent();
	}

	ngOnInit() {
		if (environment.CHATWOOT_SDK_TOKEN) {
			this.loadChatwoot(document, 'script');
		}

		this.analytics.trackPageViews();
		this.jitsuService.trackPageViews();
		this.seoService.trackCanonicalChanges();

		this.store.systemLanguages$
		.pipe(untilDestroyed(this))
		.subscribe((languages) => {
			//Returns the language code name from the browser, e.g. "en", "bg", "he", "ru"
			const browserLang = this.translate.getBrowserLang();

			//Gets default enum languages, e.g. "en", "bg", "he", "ru"
			const defaultLanguages = Object.values(LanguagesEnum);

			//Gets system languages
			let systemLanguages: string[] = _.pluck(languages, 'code');
			systemLanguages = union(systemLanguages, defaultLanguages);

			//Sets the default language to use as a fallback, e.g. "en"
			this.translate.setDefaultLang(LanguagesEnum.ENGLISH);

			//Get preferredLanguage if exist
			const preferredLanguage = this.store?.user?.preferredLanguage ?? this.store.preferredLanguage ?? null;

			//Use browser language as a primary language, if not found then use system default language, e.g. "en"
			this.translate.use(
				preferredLanguage
					? preferredLanguage
					: systemLanguages.includes(browserLang)
					? browserLang
					: LanguagesEnum.ENGLISH
			);

			this.translate.onLangChange.subscribe(() => {
				this.loading = false;
			});
		});

		if (Number(this.store.serverConnection) === 0) {
			this.loading = false;
		}
	}

	async ngAfterViewInit() {
		await this.loadLanguages();
	}

	private async loadLanguages() {
		const { items = [] } = await this.languagesService.getSystemLanguages();
		this.store.systemLanguages = items.filter(
			(item: ILanguage) => item.is_system
		);
	}

	private loadChatwoot(d, t) {
		var chatwootBaseUrl = 'https://app.chatwoot.com';
		var g = d.createElement(t),
			s = d.getElementsByTagName(t)[0];
		g.src = chatwootBaseUrl + '/packs/js/sdk.js';
		s.parentNode.insertBefore(g, s);
		g.onload = function () {
			window['chatwootSDK'].run({
				websiteToken: environment.CHATWOOT_SDK_TOKEN,
				baseUrl: chatwootBaseUrl,
			});
		};
	}

	/**
	 * GET activate router data events
	 */
	getActivateRouterDataEvent() {
		this.router.events
			.pipe(
				filter((event) => event instanceof NavigationEnd),
				map(() => this.activatedRoute),
				map((route) => {
					while (route.firstChild) route = route.firstChild;
					return route;
				}),
				filter((route) => route.outlet === 'primary'),
				mergeMap((route) => route.data),
				/**
				 * Set Date Range Picker Default Unit
				 */
				tap(({ datePicker, dates }: {
					datePicker: IDatePickerConfig;
					dates: IDateRangePicker;
					selectors: ISelectorVisibility;
				}) => {
					// Set Date Range Picker Default Unit
					const datePickerConfig = Object.assign({}, DEFAULT_DATE_PICKER_CONFIG, datePicker);
					if (isNotEmpty(dates)) {
						this.dateRangePickerBuilderService.setDateRangePicker(dates);
					}
					this.dateRangePickerBuilderService.setDatePickerConfig(datePickerConfig);
				}),
				// Set selectors' visibility
				tap(({ selectors }: { selectors?: ISelectorVisibility }) => {
					// Iterate through the visibility settings for selectors
					Object.entries(Object.assign({}, DEFAULT_SELECTOR_VISIBILITY, selectors)).forEach(([id, value]) => {
						// Set the visibility for each selector based on the provided or default value
						this.selectorBuilderService.setSelectorsVisibility(id, typeof selectors === 'boolean' ? selectors : value);
					});
					// Retrieve and get the updated selectors' visibility
					this.selectorBuilderService.getSelectorsVisibility();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
