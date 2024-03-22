---
title: 'My First Blog Post'
pubDate: 2022-07-01
description: 'This is the first post of my new Astro blog.'
author: 'Astro Learner'
image:
  url: 'https://docs.astro.build/assets/full-logo-light.png'
  alt: 'The full Astro logo.'
tags: ['astro', 'blogging', 'learning in public']
---

Back in 2017, I was working in an indie game development studio. The team was small, but the project was quite ambitious - we were making a mobile MMORPG with AR features. At a certain point through the development, we've started encountering weird issues. First, even though the development was still in the early stages, the game's build size was growing at an alarming rate. At a certain point, it even reached 2.5 GB, which is quite significant for a mobile app. Large app size is a **huge** disadvantage in the App Store/Google Play world, so making our ipa/apk smaller was crucial. Second, we had to run the game on an actual mobile device each time we wanted to test certain AR features. As development progressed, the build times were getting longer and longer. And since, as I mentioned before, the builds themself were growing in size, they were taking longer to install on a device. The game was also taking at least 15 seconds to launch! The development had been slowed down significantly because of this, and things were getting worse and worse as we were adding more content. But we were still in the early stages of development, so we were planning on adding so much more! When we started looking for what was causing these issues, we found the source rather quickly. As you've probably already guessed, all these problems were because we relied on the resources folder. We had various kinds of weapons with different animations, lots of armor sets each made up of 4 parts, and many other assets. Players could also select from 6 fantasy races and 2 genders when creating their characters. All this content had to be loaded and unloaded dynamically, so it made sense to put it into the resources folder, right? Well, no, and boy was this a bad decision.

### Don't use resources

Resources are bad. But don't take it from me, let's see what does Unity's official documentation has to say on this topic. After all, people working at Unity should know a thing or two about development with Unity engine, right? Let's take a look at the official resources folder [documentation page](https://docs.unity3d.com/Manual/BestPracticeUnderstandingPerformanceInUnity6.html).
![](https://api.longwintershadows.com/assets/resources/1.png)
As you can see, our team had encountered pretty much all of the issues mentioned on this page. Next, let's take a look at the content management [best practices article](https://learn.unity.com/tutorial/assets-resources-and-assetbundles#5c7f8528edbc2a002053b5a7).
![](https://api.longwintershadows.com/assets/resources/2.png)
Ok, so Resources shouldn't be used. But what _exactly_ is the problem with how they work? Let's take a quick look under the hood. First, let's inspect what happens at the compile time. Unity goes through all assets inside the Resources folder, resolves all of the dependencies, and simply serializes them into a single file. What's important, is that Unity does this every time the app is built, there's no build cache for resources. On the positive side, this means that developers can do pretty much anything they want with the contents of the resources folder, move files around and reorganize them as they like without having to worry about updating the cache. The negative is of course that, this means all of the dependencies will be re-serialized every time a new build is made, which in its turn means that the more files there're inside the folder, the longer the builds will take. But this isn't all. As I mentioned before, everything gets serialized into a _single file_. Here's what the contents of the compiled MacOS app look like, the contents of the resources folder got packaged in `resources.asset` file.
![](https://api.longwintershadows.com/assets/resources/3.png)
This has several implications. First, if you would want to release a patch that updates anything that's inside the resources, you would have to replace the entire resources package file! This is why the best practices page says that content that's prone to patching shouldn't be stored in resources. Also, Unity serializes all resources' content simply as is, meaning that it doesn't compress anything that isn't already compressed, and it doesn't encrypt the data either. Here's what `resources.asset` file looks like in a text editor.
![](https://api.longwintershadows.com/assets/resources/4.png)
The implications of this are, of course, that you shouldn't store any sensitive data in resources (or any data at all, for that matter). You might also end up with duplicates. For example, if you have an asset both included in the scene, and stored in resources, it'll be serialized into resources.asset and included in the scene's package.

Managing content in resources is also very cumbersome. If a file is moved, every `Resources.Load()` loading this file needs to be updated with a new path. So I've seen some developers using an interesting trick. It's possible to put only a single scriptable object in the resources folder, and make this object store references to content that will be loaded at the runtime. This way, there's no need to keep assets neatly organized inside the resources folder, and update the code every time this organization changes. Since all assets are stored as references in the scriptable object, the files could be moved around without any worry, as Unity will be taking care of updating the reference path with .meta files. Of course, this approach has its own caveats, mainly that granularity has to be sacrificed. Instead of loading only a single asset that we need at that very particular moment, we load a scriptable object that loads a bunch of assets with it. This problem could be alleviated by using several scriptable objects instead of one, with each storing references to the assets used in a similar context. However, this approach will never be as effective as loading a single asset. And this is not all. Even if there's only one scriptable object in the resources folder, unity will resolve all its dependencies during build time, and _still_ include everything into resources.asset. This means that all of the aforementioned issues also apply here.

### What are the alternatives?

The answer is, obviously, Asset Bundles. Of course, the trade-off is that they're a bit trickier to set up, and require more careful maintenance (although, this is arguable), but their advantages outweigh these disadvantages by a **huge** margin. First, asset bundles could be compressed, which reduces build sizes significantly. Second, while all resources are packaged into a single huge file, asset bundles could be broken down into parts, and those parts could be loaded separately. This is especially helpful when patching or updating content, since it allows to patch only certain bundles, instead of having to replace a giant package containing all assets. Also, asset bundles don't have to be included with the build at all and could be loaded separately, whereas resources have to always be included with the build. This allows for much smaller ipa/apk file sizes. Asset Bundles provide more control over asset management and are more powerful and convenient to work with, compared to having to maintain a particular folder structure and updating paths by which assets are accessed in code each time that structure changes with resources. There're some [runtime memory benefits as well](https://blogs.unity3d.com/2017/04/12/asset-bundles-vs-resources-a-memory-showdown/).

Switching from resources to asset bundles took our team around 5 days. The result was totally worth it. We could ship our game with a ~280mb ipa. The development sped up significantly, not only because build times got much quicker, but also because asset bundles management tools worked much better with our workflow.

### Are resources useless?

So why does this feature even exist in the first place? Well, there're a few of situations when using the resources folder is actually ok. First, is when you only started learning Unity. Asset bundles could be quite difficult to figure out for beginners. Second, is when you are making a prototype, or want to try out a certain feature or gameplay mechanic quickly. It's totally fine to use resources, or any other bad technique/anti-pattern while experimenting. Just make sure to delete the resources folder and code that relies on it once you're done! The overall point is that resources should never be used in production.

### Conclusion

And there you have it. Try to avoid using resources as much as possible. Dedicate some time to learn asset bundles. Setting them up might take more effort than just creating a resources folder, but in the end, the result will pay off manyfold.

Thank you very much for reading! ✌️

---

Meta description:
Why improper use of the Unity's Resources folder can bloat the size of a project’s build, lead to uncontrollable excessive memory utilization, and significantly increase application startup times
