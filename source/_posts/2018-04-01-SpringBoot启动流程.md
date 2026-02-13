---
title: SpringBoot启动流程
comments: true
date: 2018-04-01 15:42:04
tags: Spring SpringBoot
categories: SpringBoot
---

# Spring Boot 启动流程详解

&ensp;&ensp;&ensp;&ensp;使用SpringBoot已经有好几个月了，一直对框架当中Bean的实例化过程有很感兴趣，比如Spring是如何去加载.class文件，并解析其中我们通过注解@Configuration, @PropertySource，@ComponentScan，@Import，@Bean等产生我们自定义的Bean的。下面我们就来看看，框架当中是如何实现Bean的加载与创建的。

下面是SpringApplication函数的run函数：
```java
public ConfigurableApplicationContext run(String... args) {
		StopWatch stopWatch = new StopWatch();
		stopWatch.start();
		ConfigurableApplicationContext context = null;
		FailureAnalyzers analyzers = null;
		configureHeadlessProperty();
		SpringApplicationRunListeners listeners = getRunListeners(args);
		listeners.starting();
		try {
			ApplicationArguments applicationArguments = new DefaultApplicationArguments(args);
			ConfigurableEnvironment environment = prepareEnvironment(listeners,
					applicationArguments);
			Banner printedBanner = printBanner(environment);
			context = createApplicationContext();
			analyzers = new FailureAnalyzers(context);
			prepareContext(context, environment, listeners, applicationArguments,
					printedBanner);
			refreshContext(context);
			afterRefresh(context, applicationArguments);
			listeners.finished(context, null);
			stopWatch.stop();
			if (this.logStartupInfo) {
				new StartupInfoLogger(this.mainApplicationClass)
						.logStarted(getApplicationLog(), stopWatch);
			}
			return context;
		}
		catch (Throwable ex) {
			handleRunFailure(context, listeners, analyzers, ex);
			throw new IllegalStateException(ex);
		}
	}
```
&ensp;&ensp;&ensp;&ensp;注意，在完成了context的创建之后，会调用refreshContext函数，refreshContext函数中会调用refresh函数，在该函数中又会先调用祖先类AbstractApplicationContext类的refresh函数。该函数如下：
```java
public void refresh() throws BeansException, IllegalStateException {
		synchronized (this.startupShutdownMonitor) {
			// Prepare this context for refreshing.
			prepareRefresh();

			// Tell the subclass to refresh the internal bean factory.
			// 初始化BeanFactory
			ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

			// Prepare the bean factory for use in this context.
			// 准备工厂后处理器的使用
			prepareBeanFactory(beanFactory);

			try {
				// Allows post-processing of the bean factory in context subclasses.
				//在子类中注册BeanFactory后处理器
				postProcessBeanFactory(beanFactory);

				// Invoke factory processors registered as beans in the context.
				//调用工厂后处理器
				invokeBeanFactoryPostProcessors(beanFactory);

				// Register bean processors that intercept bean creation.
				//注册Bean后处理器
				registerBeanPostProcessors(beanFactory);

				// Initialize message source for this context.
				// 初始化信息源
				initMessageSource();

				// Initialize event multicaster for this context.
				// 初始化应用上下文时间广播
				initApplicationEventMulticaster();

				// Initialize other special beans in specific context subclasses.
				// 初始化其他特殊的Bean，有具体的子类来实现
				onRefresh();

				// Check for listener beans and register them.
				// 注册事件监听器
				registerListeners();
				
				// Instantiate all remaining (non-lazy-init) singletons.
				// 初始化所有非懒加载的单例Bean
				finishBeanFactoryInitialization(beanFactory);

				// Last step: publish corresponding event.
				// 完成刷新并发布容器刷新事件
				finishRefresh();
			}

			catch (BeansException ex) {
				if (logger.isWarnEnabled()) {
					logger.warn("Exception encountered during context initialization - " +
							"cancelling refresh attempt: " + ex);
				}

				// Destroy already created singletons to avoid dangling resources.
				destroyBeans();

				// Reset 'active' flag.
				cancelRefresh(ex);

				// Propagate exception to caller.
				throw ex;
			}

			finally {
				// Reset common introspection caches in Spring's core, since we
				// might not ever need metadata for singleton beans anymore...
				resetCommonCaches();
			}
		}
	}
```
&ensp;&ensp;&ensp;&ensp;在函数调用过程当中，调用了函数invokeBeanFactoryPostProcessors，在该函数的调用流程当中，调用链为PostProcessorRegistrationDelegate ->ConfigurationClassPostProcessor -> ConfigurationClassParser,在类ConfigurationClassParser类的doProcessConfigurationClass函数中，将启动类（即@SpringBootApplication标注的类,主要是@SpringBootApplication注解中的@Configuration注解的作用）做为入口，读取我们所定义的Bean，将其转化为一个个的BeanDefinition。下面，我们来看一下该函数的定义：
```java
protected final SourceClass doProcessConfigurationClass(ConfigurationClass configClass, SourceClass sourceClass)
			throws IOException {

		// Recursively process any member (nested) classes first
		processMemberClasses(configClass, sourceClass);

		// Process any @PropertySource annotations
		for (AnnotationAttributes propertySource : AnnotationConfigUtils.attributesForRepeatable(
				sourceClass.getMetadata(), PropertySources.class,
				org.springframework.context.annotation.PropertySource.class)) {
			if (this.environment instanceof ConfigurableEnvironment) {
				processPropertySource(propertySource);
			}
			else {
				logger.warn("Ignoring @PropertySource annotation on [" + sourceClass.getMetadata().getClassName() +
						"]. Reason: Environment must implement ConfigurableEnvironment");
			}
		}

		// Process any @ComponentScan annotations
		Set<AnnotationAttributes> componentScans = AnnotationConfigUtils.attributesForRepeatable(
				sourceClass.getMetadata(), ComponentScans.class, ComponentScan.class);
		if (!componentScans.isEmpty() &&
					!this.conditionEvaluator.shouldSkip(sourceClass.getMetadata(), ConfigurationPhase.REGISTER_BEAN)) {
			for (AnnotationAttributes componentScan : componentScans) {
				// The config class is annotated with @ComponentScan -> perform the scan immediately
				Set<BeanDefinitionHolder> scannedBeanDefinitions =
						this.componentScanParser.parse(componentScan, sourceClass.getMetadata().getClassName());
				// Check the set of scanned definitions for any further config classes and parse recursively if needed
				for (BeanDefinitionHolder holder : scannedBeanDefinitions) {
					if (ConfigurationClassUtils.checkConfigurationClassCandidate(
							holder.getBeanDefinition(), this.metadataReaderFactory)) {
						parse(holder.getBeanDefinition().getBeanClassName(), holder.getBeanName());
					}
				}
			}
		}

		// Process any @Import annotations
		processImports(configClass, sourceClass, getImports(sourceClass), true);

		// Process any @ImportResource annotations
		if (sourceClass.getMetadata().isAnnotated(ImportResource.class.getName())) {
			AnnotationAttributes importResource =
					AnnotationConfigUtils.attributesFor(sourceClass.getMetadata(), ImportResource.class);
			String[] resources = importResource.getStringArray("locations");
			Class<? extends BeanDefinitionReader> readerClass = importResource.getClass("reader");
			for (String resource : resources) {
				String resolvedResource = this.environment.resolveRequiredPlaceholders(resource);
				configClass.addImportedResource(resolvedResource, readerClass);
			}
		}

		// Process individual @Bean methods
		Set<MethodMetadata> beanMethods = retrieveBeanMethodMetadata(sourceClass);
		for (MethodMetadata methodMetadata : beanMethods) {
			configClass.addBeanMethod(new BeanMethod(methodMetadata, configClass));
		}

		// Process default methods on interfaces
		processInterfaces(configClass, sourceClass);

		// Process superclass, if any
		if (sourceClass.getMetadata().hasSuperClass()) {
			String superclass = sourceClass.getMetadata().getSuperClassName();
			if (!superclass.startsWith("java") && !this.knownSuperclasses.containsKey(superclass)) {
				this.knownSuperclasses.put(superclass, configClass);
				// Superclass found, return its annotation metadata and recurse
				return sourceClass.getSuperClass();
			}
		}

		// No superclass -> processing is complete
		return null;
	}
```
&ensp;&ensp;&ensp;&ensp;在该代码块中我们可以看到，函数首先处理由注解@PropertySource，该注解用于将我们自定义的属性文件加载到上下文环境当中。然后对@ComponentScan注解定义的包结构进行扫描，将启动类所在包下的子包中Bean文件（不包括子文件夹中的Bean文件）定义转化为BeanDefinition，如果该Bean定义的文件中也使用了@Configuration对其进行了注解，那么将会进行递归。之后，解析由注解@Import和@ImportResource注解导入的Bean定义文件，最后是直接由@Bean注解的成员函数。之后所有需要实例化的Bean都已经完成了解析，都转化为BeanDefinition，将由refresh函数中的finishBeanFactoryInitialization根据这些信息对Bean进行实例化。


欢迎关注个人公众号：
![个人公号](/images/个人公号.jpg)